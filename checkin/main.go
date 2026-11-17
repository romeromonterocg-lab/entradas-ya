// Servicio checkin: controla el ingreso a los eventos. Valida el código con tickets y registra el ingreso.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var (
	db            *pgxpool.Pool
	jwtSecret     []byte
	internalToken string
	ticketsURL    string
	clienteHTTP   *http.Client
	logger        = slog.New(slog.NewTextHandler(os.Stdout, nil)) // time, level y msg (req. 8.6)
)

// ---------- Configuración (req. 8.1) ----------

func env(nombre, porDefecto string) string {
	if v := os.Getenv(nombre); v != "" {
		return v
	}
	return porDefecto
}

func cargarConfig() (string, string) {
	_ = godotenv.Load()
	faltan := []string{}
	for _, v := range []string{"DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET", "INTERNAL_TOKEN", "TICKETS_URL"} {
		if os.Getenv(v) == "" {
			faltan = append(faltan, v)
		}
	}
	if len(faltan) > 0 {
		logger.Error("Faltan variables de entorno: " + strings.Join(faltan, ", "))
		os.Exit(1)
	}
	jwtSecret = []byte(os.Getenv("JWT_SECRET"))
	internalToken = os.Getenv("INTERNAL_TOKEN")
	ticketsURL = strings.TrimRight(os.Getenv("TICKETS_URL"), "/")
	ms, err := strconv.Atoi(env("HTTP_TIMEOUT_MS", "5000"))
	if err != nil || ms <= 0 {
		ms = 5000
	}
	clienteHTTP = &http.Client{Timeout: time.Duration(ms) * time.Millisecond} // req. 8.4

	dsn := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s connect_timeout=3",
		os.Getenv("DB_HOST"), env("DB_PORT", "5432"), os.Getenv("DB_NAME"),
		os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"))
	return dsn, env("PORT", "3007")
}

func inicializarBD(ctx context.Context) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS ingresos (
			id          SERIAL PRIMARY KEY,
			codigo      VARCHAR(32)  NOT NULL UNIQUE,  -- una entrada = un solo ingreso
			evento_id   INTEGER      NOT NULL,
			portero_id  INTEGER      NOT NULL,
			portero     VARCHAR(100),
			fecha_hora  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_ingresos_evento ON ingresos (evento_id);`)
	return err
}

// ---------- Utilidades HTTP ----------

func responder(w http.ResponseWriter, estado int, datos any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(estado)
	_ = json.NewEncoder(w).Encode(datos)
}

func errorJSON(w http.ResponseWriter, estado int, mensaje string) {
	responder(w, estado, map[string]string{"error": mensaje})
}

type grabador struct {
	http.ResponseWriter
	estado int
}

func (g *grabador) WriteHeader(c int) { g.estado = c; g.ResponseWriter.WriteHeader(c) }

func conLog(siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		g := &grabador{ResponseWriter: w, estado: 200}
		siguiente.ServeHTTP(g, r)
		logger.Info(fmt.Sprintf("%s %s -> %d (%d ms)", r.Method, r.URL.Path, g.estado, time.Since(inicio).Milliseconds()))
	})
}

// ---------- JWT (validación local, sin llamar a auth) ----------

type usuario struct {
	ID     int
	Rol    string
	Nombre string
}

type ctxKey struct{}

func conRoles(roles []string, siguiente http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tipo, token, _ := strings.Cut(r.Header.Get("Authorization"), " ")
		if tipo != "Bearer" || token == "" {
			errorJSON(w, http.StatusUnauthorized, "Falta el token")
			return
		}
		claims := jwt.MapClaims{}
		_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) { return jwtSecret, nil },
			jwt.WithValidMethods([]string{"HS256"}))
		if err != nil {
			errorJSON(w, http.StatusUnauthorized, "Token inválido o vencido")
			return
		}
		sub, _ := claims.GetSubject()
		id, err := strconv.Atoi(sub)
		rol, _ := claims["rol"].(string)
		if err != nil {
			errorJSON(w, http.StatusUnauthorized, "Token inválido")
			return
		}
		permitido := false
		for _, x := range roles {
			permitido = permitido || x == rol
		}
		if !permitido {
			errorJSON(w, http.StatusForbidden, "No tienes permiso para esta acción")
			return
		}
		nombre, _ := claims["nombre"].(string)
		siguiente(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, usuario{ID: id, Rol: rol, Nombre: nombre})))
	}
}

// ---------- Llamada a tickets ----------

type validacion struct {
	Existe   bool    `json:"existe"`
	EventoID int     `json:"evento_id"`
	Evento   string  `json:"evento"`
	Sector   string  `json:"sector"`
	Valida   bool    `json:"valida"`
	Motivo   *string `json:"motivo"`
}

func validarEnTickets(ctx context.Context, codigo string) (validacion, error) {
	var v validacion
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, ticketsURL+"/validar/"+url.PathEscape(codigo), nil)
	req.Header.Set("X-Internal-Token", internalToken)
	resp, err := clienteHTTP.Do(req)
	if err != nil {
		return v, fmt.Errorf("tickets no disponible: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return v, fmt.Errorf("tickets respondió %d", resp.StatusCode)
	}
	return v, json.NewDecoder(resp.Body).Decode(&v)
}

// ---------- Handlers ----------

func health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := db.Ping(ctx); err != nil {
		logger.Error("Health: sin conexión a la BD: " + err.Error())
		responder(w, http.StatusServiceUnavailable, map[string]string{"status": "error", "servicio": "checkin", "db": "sin conexión"})
		return
	}
	responder(w, http.StatusOK, map[string]string{"status": "ok", "servicio": "checkin", "db": "ok"})
}

type ingresoIn struct {
	Codigo   string `json:"codigo"`
	EventoID int    `json:"evento_id"`
}

type resultado struct {
	Permitido     bool       `json:"permitido"`
	Motivo        string     `json:"motivo,omitempty"`
	Codigo        string     `json:"codigo"`
	EventoID      int        `json:"evento_id,omitempty"`
	Evento        string     `json:"evento,omitempty"`
	Sector        string     `json:"sector,omitempty"`
	FechaHora     *time.Time `json:"fecha_hora,omitempty"`
	PrimerIngreso *time.Time `json:"primer_ingreso,omitempty"`
}

func rechazar(w http.ResponseWriter, res resultado, motivo string) {
	res.Permitido, res.Motivo = false, motivo
	logger.Warn(fmt.Sprintf("Ingreso RECHAZADO codigo=%s evento=%d: %s", res.Codigo, res.EventoID, motivo))
	responder(w, http.StatusOK, res)
}

// POST /ingresos { codigo, evento_id }  (portero)
// Siempre responde 200 con permitido=true/false y el motivo, para que la pantalla lo muestre claro.
func registrarIngreso(w http.ResponseWriter, r *http.Request) {
	u := r.Context().Value(ctxKey{}).(usuario)
	var in ingresoIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		errorJSON(w, http.StatusBadRequest, "JSON inválido")
		return
	}
	codigo := strings.ToUpper(strings.TrimSpace(in.Codigo))
	if codigo == "" || len(codigo) > 32 || in.EventoID <= 0 {
		errorJSON(w, http.StatusBadRequest, "codigo y evento_id son obligatorios")
		return
	}
	res := resultado{Codigo: codigo, EventoID: in.EventoID}

	// 1. Preguntar a tickets si el código existe, de qué evento es y si es válido
	v, err := validarEnTickets(r.Context(), codigo)
	if err != nil {
		logger.Error("No se pudo validar con tickets: " + err.Error())
		errorJSON(w, http.StatusServiceUnavailable, "No se pudo validar la entrada, intenta de nuevo")
		return
	}
	res.Evento, res.Sector = v.Evento, v.Sector
	switch {
	case !v.Existe:
		rechazar(w, res, "Código inválido")
		return
	case v.EventoID != in.EventoID:
		rechazar(w, res, fmt.Sprintf("Entrada de otro evento (%s)", v.Evento))
		return
	case !v.Valida:
		motivo := "Entrada no válida"
		if v.Motivo != nil {
			motivo = *v.Motivo
		}
		rechazar(w, res, motivo)
		return
	}

	// 2. Registrar el ingreso. UNIQUE(codigo) garantiza un solo ingreso aunque escaneen dos a la vez.
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	var fecha time.Time
	err = db.QueryRow(ctx,
		`INSERT INTO ingresos (codigo, evento_id, portero_id, portero) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (codigo) DO NOTHING RETURNING fecha_hora`,
		codigo, in.EventoID, u.ID, u.Nombre).Scan(&fecha)
	if errors.Is(err, pgx.ErrNoRows) {
		var primero time.Time
		_ = db.QueryRow(ctx, "SELECT fecha_hora FROM ingresos WHERE codigo = $1", codigo).Scan(&primero)
		res.PrimerIngreso = &primero
		rechazar(w, res, "Entrada ya utilizada (primer ingreso: "+primero.Local().Format("02/01/2006 15:04:05")+")")
		return
	}
	if err != nil {
		logger.Error("Error registrando ingreso: " + err.Error())
		errorJSON(w, http.StatusInternalServerError, "Error interno")
		return
	}
	res.Permitido, res.FechaHora = true, &fecha
	logger.Info(fmt.Sprintf("Ingreso PERMITIDO codigo=%s evento=%d portero=%d", codigo, in.EventoID, u.ID))
	responder(w, http.StatusOK, res)
}

// GET /eventos/{id}/ingresos -> cuántas personas ingresaron (portero u organizador)
func contarIngresos(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "id de evento inválido")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	var total int
	var ultimo *time.Time
	if err := db.QueryRow(ctx, "SELECT COUNT(*), MAX(fecha_hora) FROM ingresos WHERE evento_id = $1", id).Scan(&total, &ultimo); err != nil {
		logger.Error("Error contando ingresos: " + err.Error())
		errorJSON(w, http.StatusInternalServerError, "Error interno")
		return
	}
	responder(w, http.StatusOK, map[string]any{"evento_id": id, "ingresos": total, "ultimo_ingreso": ultimo})
}

func main() {
	dsn, puerto := cargarConfig()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var err error
	if db, err = pgxpool.New(ctx, dsn); err == nil {
		err = inicializarBD(ctx)
	}
	if err != nil {
		logger.Error("No se pudo conectar a la BD: " + err.Error())
		os.Exit(1)
	}
	logger.Info("Conexión a la BD correcta, tabla ingresos lista")

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", health)
	mux.HandleFunc("POST /ingresos", conRoles([]string{"portero"}, registrarIngreso))
	mux.HandleFunc("GET /eventos/{id}/ingresos", conRoles([]string{"portero", "organizador"}, contarIngresos))

	servidor := &http.Server{Addr: ":" + puerto, Handler: conLog(mux), ReadHeaderTimeout: 5 * time.Second}
	logger.Info("checkin escuchando en el puerto " + puerto)
	if err := servidor.ListenAndServe(); err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
}
