# 🖤 PABUCON 2026 — Guía de Despliegue AWS

## Archivos del backend
| Archivo | Descripción |
|---|---|
| `lambda_register.py` | `POST /register` — Guarda asistente + anti-duplicado |
| `lambda_count.py` | `GET /count` — Conteo público de cupos |
| `lambda_admin.py` | `GET /registrations` — Lista completa (solo admin) |

---

## PASO 1 — DynamoDB

1. Ir a **AWS Console → DynamoDB → Create table**
2. **Table name:** `pabucon2026-registrations`
3. **Partition key:** `deviceId` (String)
4. **Billing mode:** On-demand (para eventos pequeños es gratis prácticamente)
5. Clic en **Create table**

---

## PASO 2 — IAM Role para Lambda

1. Ir a **IAM → Roles → Create role**
2. Use case: **Lambda**
3. Attach policies:
   - `AmazonDynamoDBFullAccess` (o una policy más restrictiva solo para tu tabla)
   - `AWSLambdaBasicExecutionRole`
4. Nombre del rol: `pabucon2026-lambda-role`

---

## PASO 3 — Crear las 3 Lambda Functions

Para cada archivo (`lambda_register.py`, `lambda_count.py`, `lambda_admin.py`):

1. **Lambda → Create function → Author from scratch**
2. Nombre: `pabucon2026-register` / `pabucon2026-count` / `pabucon2026-admin`
3. Runtime: **Python 3.12**
4. Execution role: usar el rol creado en Paso 2
5. Pegar el código del archivo correspondiente
6. **Deploy**

### Variables de entorno (cada Lambda):
Ir a **Configuration → Environment variables → Edit:**

| Variable | Valor |
|---|---|
| `TABLE_NAME` | `pabucon2026-registrations` |
| `MAX_CAPACITY` | `15` |
| Solo para `lambda_admin.py`: | |
| `ADMIN_PASSWORD_HASH` | SHA-256 de tu contraseña (ver abajo) |

### Generar el hash de contraseña:
```bash
# En tu terminal (Python):
python -c "import hashlib; print(hashlib.sha256(b'TuContraseñaAquí').hexdigest())"
```
Copia el resultado y ponlo como valor de `ADMIN_PASSWORD_HASH`.

---

## PASO 4 — API Gateway

1. **API Gateway → Create API → HTTP API** (más barato que REST API)
2. Nombre: `pabucon2026-api`
3. **Add integration → Lambda → pabucon2026-register**
4. **Add routes:**

| Método | Ruta | Lambda |
|---|---|---|
| `POST` | `/register` | `pabucon2026-register` |
| `GET` | `/count` | `pabucon2026-count` |
| `GET` | `/registrations` | `pabucon2026-admin` |
| `OPTIONS` | `/{proxy+}` | (CORS automático) |

5. **CORS:** Configurar en API Gateway también:
   - Allow origins: `*` (o tu dominio de GitHub Pages)
   - Allow methods: `GET, POST, OPTIONS`
   - Allow headers: `Content-Type, Authorization`

6. **Deploy → Copiar la URL** que se genera, ejemplo:
   ```
   https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
   ```

---

## PASO 5 — Conectar el Frontend

### En `script.js`, línea ~11:
```js
API_BASE_URL: 'https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod',
```

### En `admin.html`, línea ~4 del `<script>`:
```js
const ADMIN_API = 'https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod';
```

---

## PASO 6 — Publicar en GitHub Pages

```bash
# En la carpeta pabucon2026/ (solo los archivos frontend, NO el backend)
git init
git add index.html style.css script.js admin.html
git commit -m "Pabucon 2026 launch 🖤♥"
git remote add origin https://github.com/TU_USUARIO/pabucon2026.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: main branch** → Save

Tu URL quedará como: `https://TU_USUARIO.github.io/pabucon2026/`

---

## 💰 Costo Estimado (para 15 personas)

| Servicio | Costo |
|---|---|
| DynamoDB (15 registros) | **~$0.00** (free tier cubre 25GB y 25 WCU) |
| Lambda (pocas invocaciones) | **~$0.00** (1M requests gratis/mes) |
| API Gateway (HTTP API) | **~$0.00** (<1M requests = free tier) |
| GitHub Pages | **$0.00** |
| **Total** | **$0 🎉** |

---

## 🔒 Seguridad del Anti-Multiregistro

El sistema usa 3 capas:
1. **LocalStorage**: verificación instantánea en el navegador. El más fácil de bypassear pero cubre el 99% de usuarios.
2. **FingerprintJS**: hash del dispositivo basado en ~50 señales (user agent, resolución, timezone, fuentes, etc.). Muy difícil de duplicar para usuarios no técnicos.
3. **DynamoDB `ConditionExpression`**: el `deviceId` es PK. Incluso si alguien borra el localStorage, la BD rechaza el segundo registro con 409.

> ⚠️ No es 100% infalible para usuarios muy técnicos (VPN + browser distinto + clearear storage). Para un evento de amigos es más que suficiente.

---

## 📁 Estructura del Proyecto

```
pabucon2026/
├── index.html       ← Página principal (invitación + registro)
├── style.css        ← Tema dark Kingdom Hearts
├── script.js        ← Partículas + countdown + FingerprintJS + API
├── admin.html       ← Panel de administrador
└── backend/
    ├── lambda_register.py    ← AWS Lambda: POST /register
    ├── lambda_count.py       ← AWS Lambda: GET /count
    ├── lambda_admin.py       ← AWS Lambda: GET /registrations
    └── README.md             ← Este archivo
```
