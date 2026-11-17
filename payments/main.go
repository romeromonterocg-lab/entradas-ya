// Servicio payments: pasarela de pago simulada (interno, solo lo llama orders).
package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var (
	db            *pgxpool.Pool
	internalToken string
	logger        = slog.New(slog.NewTextHandler(os.Stdout, nil)) // time, level y msg (req. 8.6)
)

// ---------- Configuración (req. 8.1: todo por variables de entorno) ----------

func env(nombre, porDefecto string) string {
	if v := os.Getenv(nombre); v != "" {
		return v
	}
	return porDefecto
}

func cargarConfig() (string, string) {
	_ = godotenv.Load() // lee .env si existe
	faltan := []string{}
	for _, v := range []string{"DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "INTERNAL_TOKEN"} {
		if os.Getenv(v) == "" {
			faltan = append(faltan, v)
		}
	}
	if len(faltan) > 0 {
		logger.Error("Faltan variables de entorno: " + strings.Join(faltan, ", "))
		os.Exit(1)
	}
	internalToken = os.Getenv("INTERNAL_TOKEN")
	dsn := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s connect_timeout=3",
		os.Getenv("DB_HOST"), env("DB_PORT", "5432"), os.Getenv("DB_NAME"),
		os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"))
	return dsn, env("PORT", "3003")
}

func inicializarBD(ctx context.Context) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS transacciones (
			id          SERIAL PRIMARY KEY,
			orden_id    VARCHAR(64)   NOT NULL UNIQUE,
			monto       NUMERIC(10,2) NOT NULL CHECK (monto > 0),
			tarjeta     VARCHAR(4)    NOT NULL,  -- solo los últimos 4 dígitos
			resultado   VARCHAR(20)   NOT NULL CHECK (resultado IN ('aprobado', 'rechazado')),
			motivo      VARCHAR(100),
			creado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
		)`)
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

// Registra cada petición en el log
func conLog(siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		g := &grabador{ResponseWriter: w, estado: 200}
		siguiente.ServeHTTP(g, r)
		logger.Info(fmt.Sprintf("%s %s -> %d (%d ms)", r.Method, r.URL.Path, g.estado, time.Since(inicio).Milliseconds()))
	})
}

// Solo deja pasar a quien envía la clave interna (orders)
func soloInterno(siguiente http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		recibido := r.Header.Get("X-Internal-Token")
		if subtle.ConstantTimeCompare([]byte(recibido), []byte(internalToken)) != 1 {
			errorJSON(w, http.StatusUnauthorized, "Servicio interno: falta o es incorrecta la clave X-Internal-Token")
			return
		}
		siguiente(w, r)
	}
}

// ---------- Modelo ----------

type Transaccion struct {
	ID        int       `json:"id"`
	OrdenID   string    `json:"orden_id"`
	Monto     float64   `json:"monto"`
	Tarjeta   string    `json:"tarjeta"`
	Resultado string    `json:"resultado"`
	Motivo    *string   `json:"motivo"`
	CreadoEn  time.Time `json:"creado_en"`
}

const columnas = "id, orden_id, monto::float8, tarjeta, resultado, motivo, creado_en"

func leer(fila pgx.Row) (Transaccion, error) {
	var t Transaccion
	err := fila.Scan(&t.ID, &t.OrdenID, &t.Monto, &t.Tarjeta, &t.Resultado, &t.Motivo, &t.CreadoEn)
	return t, err
}

// ---------- Handlers ----------

func health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := db.Ping(ctx); err != nil {
		logger.Error("Health: sin conexión a la BD: " + err.Error())
		responder(w, http.StatusServiceUnavailable, map[string]string{"status": "error", "servicio": "payments", "db": "sin conexión"})
		return
	}
	responder(w, http.StatusOK, map[string]string{"status": "ok", "servicio": "payments", "db": "ok"})
}

type pagoIn struct {
	OrdenID string  `json:"orden_id"`
	Monto   float64 `json:"monto"`
	Tarjeta string  `json:"tarjeta"`
}

// POST /pagos  { orden_id, monto, tarjeta }
// Regla fija: tarjeta terminada en 0000 = rechazado. Misma orden = misma respuesta (no cobra dos veces).
func crearPago(w http.ResponseWriter, r *http.Request) {
	var in pagoIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		errorJSON(w, http.StatusBadRequest, "JSON inválido")
		return
	}
	tarjeta := strings.ReplaceAll(strings.ReplaceAll(in.Tarjeta, " ", ""), "-", "")
	switch {
	case in.OrdenID == "" || len(in.OrdenID) > 64:
		errorJSON(w, http.StatusBadRequest, "orden_id es obligatorio (máx 64 caracteres)")
		return
	case in.Monto <= 0:
		errorJSON(w, http.StatusBadRequest, "monto debe ser mayor a 0")
		return
	case len(tarjeta) < 12 || len(tarjeta) > 19 || strings.IndexFunc(tarjeta, func(c rune) bool { return !unicode.IsDigit(c) }) >= 0:
		errorJSON(w, http.StatusBadRequest, "tarjeta debe tener entre 12 y 19 dígitos")
		return
	}

	resultado, motivo := "aprobado", (*string)(nil)
	if strings.HasSuffix(tarjeta, "0000") {
		resultado = "rechazado"
		m := "Tarjeta rechazada por el banco (simulado)"
		motivo = &m
	}
	ultimos4 := tarjeta[len(tarjeta)-4:]

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	// ON CONFLICT: si la orden ya tiene transacción no inserta otra (idempotencia, incluso con peticiones simultáneas)
	t, err := leer(db.QueryRow(ctx,
		`INSERT INTO transacciones (orden_id, monto, tarjeta, resultado, motivo)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (orden_id) DO NOTHING
		 RETURNING `+columnas,
		in.OrdenID, in.Monto, ultimos4, resultado, motivo))

	if errors.Is(err, pgx.ErrNoRows) {
		previa, err := leer(db.QueryRow(ctx, "SELECT "+columnas+" FROM transacciones WHERE orden_id = $1", in.OrdenID))
		if err != nil {
			logger.Error("Error leyendo transacción previa: " + err.Error())
			errorJSON(w, http.StatusInternalServerError, "Error interno")
			return
		}
		logger.Info(fmt.Sprintf("Pago repetido para orden=%s: se devuelve el resultado anterior (%s)", in.OrdenID, previa.Resultado))
		responder(w, http.StatusOK, previa)
		return
	}
	if err != nil {
		logger.Error("Error registrando pago: " + err.Error())
		errorJSON(w, http.StatusInternalServerError, "Error interno")
		return
	}
	logger.Info(fmt.Sprintf("Pago %s: orden=%s monto=%.2f tarjeta=****%s", t.Resultado, t.OrdenID, t.Monto, t.Tarjeta))
	responder(w, http.StatusCreated, t)
}

// GET /pagos/{orden_id}
func verPago(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	t, err := leer(db.QueryRow(ctx, "SELECT "+columnas+" FROM transacciones WHERE orden_id = $1", r.PathValue("orden_id")))
	if errors.Is(err, pgx.ErrNoRows) {
		errorJSON(w, http.StatusNotFound, "No hay pago para esa orden")
		return
	}
	if err != nil {
		logger.Error("Error consultando pago: " + err.Error())
		errorJSON(w, http.StatusInternalServerError, "Error interno")
		return
	}
	responder(w, http.StatusOK, t)
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
	logger.Info("Conexión a la BD correcta, tabla transacciones lista")

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", health)
	mux.HandleFunc("POST /pagos", soloInterno(crearPago))
	mux.HandleFunc("GET /pagos/{orden_id}", soloInterno(verPago))

	servidor := &http.Server{
		Addr:              ":" + puerto,
		Handler:           conLog(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	logger.Info("payments escuchando en el puerto " + puerto)
	if err := servidor.ListenAndServe(); err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
}
