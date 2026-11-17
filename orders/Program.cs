// Servicio orders: recibe la compra y coordina events -> payments -> tickets -> notifications.
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

// ---------- Configuración (req. 8.1: todo por variables de entorno) ----------
DotNetEnv.Env.TraversePath().NoClobber().Load();

string Env(string nombre, string? porDefecto = null) =>
    Environment.GetEnvironmentVariable(nombre) is { Length: > 0 } v ? v
    : porDefecto ?? throw new InvalidOperationException($"Falta la variable de entorno {nombre}");

var requeridas = new[] { "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET", "INTERNAL_TOKEN",
                         "EVENTS_URL", "PAYMENTS_URL", "TICKETS_URL", "NOTIFICATIONS_URL" };
var faltan = requeridas.Where(v => string.IsNullOrEmpty(Environment.GetEnvironmentVariable(v))).ToList();
if (faltan.Count > 0)
{
    Console.Error.WriteLine($"{DateTime.Now:yyyy-MM-ddTHH:mm:ss} [ERROR] Faltan variables de entorno: {string.Join(", ", faltan)}");
    return 1;
}

var puerto = Env("PORT", "3006");
var cadenaBd = new NpgsqlConnectionStringBuilder
{
    Host = Env("DB_HOST"), Port = int.Parse(Env("DB_PORT", "5432")), Database = Env("DB_NAME"),
    Username = Env("DB_USER"), Password = Env("DB_PASSWORD"), Timeout = 3,
}.ConnectionString;
var internalToken = Env("INTERNAL_TOKEN");
var timeout = TimeSpan.FromMilliseconds(int.Parse(Env("HTTP_TIMEOUT_MS", "5000")));

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls($"http://0.0.0.0:{puerto}");

// Logs en consola con fecha, nivel y mensaje (req. 8.6)
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(o => { o.SingleLine = true; o.TimestampFormat = "yyyy-MM-ddTHH:mm:ss "; });
builder.Logging.AddFilter("Microsoft", LogLevel.Warning);
builder.Logging.AddFilter("System.Net.Http", LogLevel.Warning);

// JSON en snake_case (igual que los demás servicios)
var json = new JsonSerializerOptions(JsonSerializerDefaults.Web) { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);

// Validación local del JWT emitido por auth (sin llamar a auth)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false, ValidateAudience = false, ValidateLifetime = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Env("JWT_SECRET"))),
        ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
        NameClaimType = "sub", RoleClaimType = "rol",
    };
});
builder.Services.AddAuthorization();

// Un HttpClient por servicio, todos con tiempo máximo de espera (req. 8.4)
void Cliente(string nombre, string url) => builder.Services.AddHttpClient(nombre, c =>
{
    c.BaseAddress = new Uri(url.TrimEnd('/') + "/");
    c.Timeout = timeout;
});
Cliente("events", Env("EVENTS_URL"));
Cliente("payments", Env("PAYMENTS_URL"));
Cliente("tickets", Env("TICKETS_URL"));
Cliente("notifications", Env("NOTIFICATIONS_URL"));

var app = builder.Build();
var log = app.Logger;
app.UseAuthentication();
app.UseAuthorization();

// Log de cada petición
app.Use(async (ctx, next) =>
{
    var inicio = DateTime.UtcNow;
    await next();
    log.LogInformation("{Metodo} {Ruta} -> {Estado} ({Ms} ms)", ctx.Request.Method, ctx.Request.Path,
        ctx.Response.StatusCode, (int)(DateTime.UtcNow - inicio).TotalMilliseconds);
});

// ---------- Base de datos ----------
async Task<NpgsqlConnection> Conectar()
{
    var c = new NpgsqlConnection(cadenaBd);
    await c.OpenAsync();
    return c;
}

try
{
    await using var c = await Conectar();
    await using var cmd = new NpgsqlCommand("""
        CREATE TABLE IF NOT EXISTS ordenes (
            id              VARCHAR(64)   PRIMARY KEY,
            usuario_id      INTEGER       NOT NULL,
            correo          VARCHAR(150)  NOT NULL,
            sector_id       INTEGER       NOT NULL,
            cantidad        INTEGER       NOT NULL CHECK (cantidad BETWEEN 1 AND 6),
            evento_id       INTEGER,
            evento          VARCHAR(150),
            sector          VARCHAR(50),
            precio_unitario NUMERIC(10,2),
            total           NUMERIC(10,2),
            tarjeta         VARCHAR(4),
            estado          VARCHAR(20)   NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente', 'pagada', 'rechazada', 'cancelada')),
            motivo          VARCHAR(200),
            entradas        TEXT[]        NOT NULL DEFAULT '{}',
            correo_enviado  BOOLEAN       NOT NULL DEFAULT FALSE,
            creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ordenes_usuario ON ordenes (usuario_id);
        """, c);
    await cmd.ExecuteNonQueryAsync();
    log.LogInformation("Conexión a la BD correcta, tabla ordenes lista");
}
catch (Exception e)
{
    log.LogError("No se pudo conectar a la BD: {Error}", e.Message);
    return 1;
}

async Task Actualizar(string id, string sql, params (string, object?)[] parametros)
{
    await using var c = await Conectar();
    await using var cmd = new NpgsqlCommand($"UPDATE ordenes SET {sql}, actualizado_en = NOW() WHERE id = @id", c);
    cmd.Parameters.AddWithValue("id", id);
    foreach (var (n, v) in parametros) cmd.Parameters.AddWithValue(n, v ?? DBNull.Value);
    await cmd.ExecuteNonQueryAsync();
}

async Task<List<Dictionary<string, object?>>> Consultar(string sql, params (string, object)[] parametros)
{
    await using var c = await Conectar();
    await using var cmd = new NpgsqlCommand(sql, c);
    foreach (var (n, v) in parametros) cmd.Parameters.AddWithValue(n, v);
    await using var r = await cmd.ExecuteReaderAsync();
    var filas = new List<Dictionary<string, object?>>();
    while (await r.ReadAsync())
    {
        var fila = new Dictionary<string, object?>();
        for (var i = 0; i < r.FieldCount; i++) fila[r.GetName(i)] = r.IsDBNull(i) ? null : r.GetValue(i);
        filas.Add(fila);
    }
    return filas;
}

async Task<Dictionary<string, object?>?> Orden(string id) =>
    (await Consultar("SELECT * FROM ordenes WHERE id = @id", ("id", id))).FirstOrDefault();

// ---------- Llamadas a otros servicios ----------
HttpRequestMessage Peticion(HttpMethod metodo, string ruta, object? cuerpo, string? bearer = null)
{
    var m = new HttpRequestMessage(metodo, ruta);
    if (cuerpo != null) m.Content = JsonContent.Create(cuerpo, options: json);
    if (bearer != null) m.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
    else m.Headers.Add("X-Internal-Token", internalToken);
    return m;
}

async Task<(HttpStatusCode? estado, JsonNode? cuerpo, string? error)> Llamar(
    IHttpClientFactory f, string servicio, HttpRequestMessage m)
{
    try
    {
        using var r = await f.CreateClient(servicio).SendAsync(m);
        var texto = await r.Content.ReadAsStringAsync();
        JsonNode? nodo = null;
        try { nodo = JsonNode.Parse(texto); } catch { /* respuesta no JSON */ }
        return (r.StatusCode, nodo, null);
    }
    catch (TaskCanceledException) { return (null, null, $"{servicio} no respondió a tiempo"); }
    catch (HttpRequestException e) { return (null, null, $"{servicio} no disponible: {e.Message}"); }
}

async Task Liberar(IHttpClientFactory f, string ordenId, string bearer)
{
    var (estado, _, error) = await Llamar(f, "events", Peticion(HttpMethod.Post, $"reservas/{ordenId}/liberar", null, bearer));
    if (estado == HttpStatusCode.OK) log.LogInformation("Cupos liberados para orden={Orden}", ordenId);
    else log.LogError("No se pudieron liberar los cupos de orden={Orden}: {Error}", ordenId, error ?? estado.ToString());
}

object Publica(Dictionary<string, object?> o) => new
{
    id = o["id"], estado = o["estado"], motivo = o["motivo"],
    evento_id = o["evento_id"], evento = o["evento"], sector_id = o["sector_id"], sector = o["sector"],
    cantidad = o["cantidad"], precio_unitario = o["precio_unitario"], total = o["total"],
    tarjeta = o["tarjeta"] is string t ? $"****{t}" : null,
    entradas = o["entradas"], correo_enviado = o["correo_enviado"],
    creado_en = o["creado_en"], actualizado_en = o["actualizado_en"],
};

// ---------- Endpoints ----------
app.MapGet("/health", async () =>
{
    try
    {
        await using var c = await Conectar();
        await using var cmd = new NpgsqlCommand("SELECT 1", c);
        await cmd.ExecuteScalarAsync();
        return Results.Ok(new { status = "ok", servicio = "orders", db = "ok" });
    }
    catch (Exception e)
    {
        log.LogError("Health: sin conexión a la BD: {Error}", e.Message);
        return Results.Json(new { status = "error", servicio = "orders", db = "sin conexión" }, statusCode: 503);
    }
});

// POST /ordenes  { sector_id, cantidad, tarjeta }  -> flujo completo de compra
app.MapPost("/ordenes", async (CompraIn compra, ClaimsPrincipal user, HttpContext ctx, IHttpClientFactory f) =>
{
    if (user.FindFirstValue("rol") != "cliente")
        return Results.Json(new { error = "Solo un cliente puede comprar" }, statusCode: 403);
    if (compra.Cantidad is < 1 or > 6)
        return Results.BadRequest(new { error = "La cantidad debe ser entre 1 y 6 entradas" });
    if (compra.SectorId <= 0 || string.IsNullOrWhiteSpace(compra.Tarjeta))
        return Results.BadRequest(new { error = "sector_id y tarjeta son obligatorios" });

    var usuarioId = int.Parse(user.FindFirstValue("sub")!);
    var correo = user.FindFirstValue("correo") ?? "";
    var nombre = user.FindFirstValue("nombre") ?? "cliente";
    var bearer = ctx.Request.Headers.Authorization.ToString()["Bearer ".Length..];
    var id = Guid.NewGuid().ToString();

    // 1. Crear orden pendiente
    await using (var c = await Conectar())
    {
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO ordenes (id, usuario_id, correo, sector_id, cantidad) VALUES (@id, @u, @c, @s, @n)", c);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("u", usuarioId);
        cmd.Parameters.AddWithValue("c", correo);
        cmd.Parameters.AddWithValue("s", compra.SectorId);
        cmd.Parameters.AddWithValue("n", compra.Cantidad);
        await cmd.ExecuteNonQueryAsync();
    }
    log.LogInformation("Orden creada: id={Orden} usuario={Usuario} sector={Sector} cantidad={Cantidad}",
        id, usuarioId, compra.SectorId, compra.Cantidad);

    // 2. Reservar cupos en events
    var (estR, reserva, errR) = await Llamar(f, "events", Peticion(HttpMethod.Post, "reservas",
        new { orden_id = id, sector_id = compra.SectorId, cantidad = compra.Cantidad }, bearer));
    if (estR != HttpStatusCode.Created && estR != HttpStatusCode.OK)
    {
        var motivo = errR ?? reserva?["detail"]?.ToString() ?? $"events respondió {(int?)estR}";
        await Actualizar(id, "estado = 'cancelada', motivo = @m", ("m", motivo));
        log.LogWarning("Orden {Orden} cancelada al reservar: {Motivo}", id, motivo);
        var codigo = estR switch
        {
            HttpStatusCode.Conflict => 409,
            HttpStatusCode.NotFound => 404,
            HttpStatusCode.UnprocessableEntity => 400,
            null => 503,
            _ => 502,
        };
        return Results.Json(new { error = motivo, orden = Publica((await Orden(id))!) }, statusCode: codigo);
    }

    var precio = reserva!["precio_unitario"]!.GetValue<double>();
    var total = reserva["total"]!.GetValue<double>();
    var tarjeta = new string(compra.Tarjeta.Where(char.IsDigit).ToArray());
    await Actualizar(id,
        "evento_id = @ei, evento = @e, sector = @s, precio_unitario = @p, total = @t, tarjeta = @tj",
        ("ei", reserva["evento_id"]!.GetValue<int>()), ("e", reserva["evento"]!.ToString()),
        ("s", reserva["sector"]!.ToString()), ("p", (decimal)precio), ("t", (decimal)total),
        ("tj", tarjeta.Length >= 4 ? tarjeta[^4..] : tarjeta));

    // 3. Cobrar en payments
    var (estP, pago, errP) = await Llamar(f, "payments", Peticion(HttpMethod.Post, "pagos",
        new { orden_id = id, monto = total, tarjeta = compra.Tarjeta }));
    var resultado = pago?["resultado"]?.ToString();
    if (resultado != "aprobado")
    {
        var motivo = resultado == "rechazado"
            ? pago!["motivo"]?.ToString() ?? "Pago rechazado"
            : errP ?? pago?["error"]?.ToString() ?? $"payments respondió {(int?)estP}";
        await Liberar(f, id, bearer);
        var estadoFinal = resultado == "rechazado" ? "rechazada" : "cancelada";
        await Actualizar(id, "estado = @e, motivo = @m", ("e", estadoFinal), ("m", motivo));
        log.LogWarning("Orden {Orden} {Estado}: {Motivo}", id, estadoFinal, motivo);
        var codigo = resultado == "rechazado" ? 402 : estP == HttpStatusCode.BadRequest ? 400 : 503;
        return Results.Json(new { error = motivo, orden = Publica((await Orden(id))!) }, statusCode: codigo);
    }
    await Actualizar(id, "estado = 'pagada'");
    log.LogInformation("Orden {Orden} pagada: total={Total}", id, total);

    // 4. Generar entradas en tickets (la orden ya está pagada aunque esto falle)
    var codigos = new List<string>();
    var (estT, entradas, errT) = await Llamar(f, "tickets", Peticion(HttpMethod.Post, "entradas", new
    {
        orden_id = id, usuario_id = usuarioId, evento_id = reserva["evento_id"]!.GetValue<int>(),
        evento = reserva["evento"]!.ToString(), fecha = reserva["fecha"]!.ToString(),
        lugar = reserva["lugar"]!.ToString(), sector = reserva["sector"]!.ToString(),
        precio_unitario = precio, cantidad = compra.Cantidad,
    }));
    if (estT is HttpStatusCode.Created or HttpStatusCode.OK && entradas is JsonArray lista)
    {
        codigos = lista.Select(e => e!["codigo"]!.ToString()).ToList();
        await Actualizar(id, "entradas = @c", ("c", codigos.ToArray()));
        log.LogInformation("Orden {Orden}: {N} entradas emitidas", id, codigos.Count);
    }
    else
    {
        var motivo = errT ?? $"tickets respondió {(int?)estT}";
        await Actualizar(id, "motivo = @m", ("m", $"Entradas pendientes de emitir: {motivo}"));
        log.LogError("Orden {Orden}: no se pudieron emitir las entradas: {Motivo}", id, motivo);
    }

    // 5. Enviar correo (si falla, la compra sigue siendo válida)
    if (codigos.Count > 0)
    {
        var (estN, _, errN) = await Llamar(f, "notifications", Peticion(HttpMethod.Post, "notificaciones/compra", new
        {
            correo, nombre, orden_id = id, evento = reserva["evento"]!.ToString(),
            fecha = reserva["fecha"]!.ToString(), lugar = reserva["lugar"]!.ToString(),
            sector = reserva["sector"]!.ToString(), cantidad = compra.Cantidad, total, entradas = codigos,
        }));
        if (estN == HttpStatusCode.Accepted)
            await Actualizar(id, "correo_enviado = TRUE");
        else
            log.LogWarning("Orden {Orden}: no se envió el correo ({Error}). La compra sigue válida.",
                id, errN ?? $"notifications respondió {(int?)estN}");
    }

    return Results.Json(Publica((await Orden(id))!), statusCode: 201);
}).RequireAuthorization();

// GET /ordenes -> historial de compras del cliente
app.MapGet("/ordenes", async (ClaimsPrincipal user) =>
{
    var filas = await Consultar("SELECT * FROM ordenes WHERE usuario_id = @u ORDER BY creado_en DESC",
        ("u", int.Parse(user.FindFirstValue("sub")!)));
    return Results.Ok(filas.Select(Publica));
}).RequireAuthorization();

// GET /ordenes/{id} -> detalle (solo el dueño)
app.MapGet("/ordenes/{id}", async (string id, ClaimsPrincipal user) =>
{
    var o = await Orden(id);
    if (o == null || (int)o["usuario_id"]! != int.Parse(user.FindFirstValue("sub")!))
        return Results.NotFound(new { error = "Orden no encontrada" });
    return Results.Ok(Publica(o));
}).RequireAuthorization();

log.LogInformation("orders escuchando en el puerto {Puerto}", puerto);
await app.RunAsync();
return 0;

record CompraIn(int SectorId, int Cantidad, string Tarjeta);
