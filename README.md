# UX Evaluation Framework

Herramienta interna para evaluar features digitales con una rúbrica objetiva de 10 criterios ponderados. Construida con React 18, Vite, Supabase y TailwindCSS.

> **Nota sobre la paleta de colores**
> Los colores de este producto (`#0F1117`, `#93B4FA`, `#34D399`, etc.) son propios del UX Evaluation Framework y no pertenecen ni representan a ninguna marca comercial. El esquema dark-first fue diseñado específicamente para sesiones de evaluación en entornos controlados.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18 + Vite |
| Routing | React Router v6 |
| Estilos | TailwindCSS (tema dark personalizado) |
| Backend / Auth | Supabase (PostgreSQL + Auth) |
| Gráficos | Recharts |
| Deploy | Vercel |

---

## Setup local en 5 pasos

### 1. Clonar el repositorio

```bash
git clone https://github.com/<tu-org>/evaluation-ux.git
cd evaluation-ux
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Abre `.env` y pega los valores desde tu proyecto en Supabase:

```
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
```

Encuéntralos en: **Supabase Dashboard → Project Settings → API**

### 4. Inicializar la base de datos

En el **SQL Editor** de Supabase Dashboard, ejecuta los archivos en este orden:

```
supabase/schema.sql      ← tablas, índices, vista y RLS base
supabase/functions.sql   ← función save_evaluation() v1
supabase/rls_v2.sql      ← políticas por rol + función actualizada
```

> Ejecuta siempre en ese orden. `rls_v2.sql` requiere que las tablas y la función ya existan.

### 5. Iniciar el servidor de desarrollo

```bash
npm run dev
```

La app estará disponible en `http://localhost:5173`.

---

## Estructura del proyecto

```
src/
├── components/
│   ├── Header.jsx          ← barra superior con branding
│   ├── TabNav.jsx          ← navegación + badge de rol + sign-out
│   ├── ProtectedRoute.jsx  ← guardia de autenticación y roles
│   ├── ScoreBadge.jsx
│   └── WeightBar.jsx
├── hooks/
│   ├── useAuth.jsx         ← AuthProvider + useAuth()
│   ├── useFlows.js         ← useFlows() · useFlow(id)
│   └── useEvaluations.js   ← useEvaluations() · saveEvaluation()
├── pages/
│   ├── LoginPage.jsx       ← magic link (sin contraseña)
│   ├── FlowsPage.jsx       ← listado de flujos
│   ├── FlowDetailPage.jsx  ← historial + gráfico de tendencia
│   ├── RubricTab.jsx       ← rúbrica de 10 criterios
│   ├── EvaluadorTab.jsx    ← evaluador interactivo
│   └── FrameworkTab.jsx    ← distribución de pesos y justificación
├── data/
│   ├── criteria.js         ← los 10 criterios con escalas 1/5/10
│   └── justifications.js
├── utils/scoring.js
└── lib/supabase.js

supabase/
├── schema.sql              ← DDL completo + RLS base
├── functions.sql           ← save_evaluation() (transacción atómica)
└── rls_v2.sql              ← políticas por rol (admin / evaluador / viewer)
```

---

## Deploy en Vercel

El deploy es **automático en cada push a `main`**. No se requieren GitHub Actions ni configuración adicional de CI/CD: Vercel detecta el proyecto Vite, lo construye y publica.

### Pasos para conectar el repositorio

1. **Importar el repositorio**
   - Ve a [vercel.com/new](https://vercel.com/new)
   - Conecta tu cuenta de GitHub si aún no lo has hecho
   - Selecciona el repositorio `evaluation-ux`

2. **Configurar el proyecto**
   - Framework Preset: **Vite** (Vercel lo detecta automáticamente)
   - Build Command: `npm run build` (valor por defecto, no cambiar)
   - Output Directory: `dist` (valor por defecto, no cambiar)

3. **Agregar las variables de entorno**
   - En la pantalla de configuración inicial — o después en **Project Settings → Environment Variables** — agrega:

   | Variable | Valor |
   |----------|-------|
   | `VITE_SUPABASE_URL` | URL de tu proyecto en Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Clave `anon / public` de Supabase |

   > Márcalas como activas en los entornos **Production**, **Preview** y **Development**.

4. **Primer deploy**
   - Haz clic en **Deploy**
   - Vercel construye el proyecto y publica en `https://<tu-proyecto>.vercel.app`

5. **Registrar la URL en Supabase**
   - Ve a **Supabase Dashboard → Authentication → URL Configuration**
   - **Site URL**: `https://<tu-proyecto>.vercel.app`
   - **Redirect URLs**: agrega `https://<tu-proyecto>.vercel.app` y `http://localhost:5173` (para desarrollo)

   Esto es necesario para que los magic links redirijan al dominio correcto.

### Deploys automáticos

A partir de ahora, cada `git push origin main` dispara un deploy de producción en Vercel. Los pull requests generan **Preview Deployments** con URL única, útiles para revisión antes de mergear.

```
git push origin main   →   Vercel detecta el push
                       →   Ejecuta: npm run build
                       →   Publica en producción (~30 seg)
```

---

## Cómo invitar un nuevo evaluador

El sistema no tiene registro público. El flujo de incorporación es el siguiente:

### 1. El admin invita al usuario

En **Supabase Dashboard → Authentication → Users → Invite user**:

- Ingresa el email institucional del nuevo usuario
- Haz clic en **Send Invitation**
- Supabase envía un magic link al correo

### 2. El usuario accede por primera vez

- El usuario hace clic en el link del correo
- Es redirigido a la app (ya autenticado)
- Aparece la pantalla **"Elige tu rol de acceso"**
- El usuario selecciona su rol: `Evaluador`

### 3. Verificar o ajustar el rol (opcional)

Si necesitas cambiar el rol de un usuario después de su primer login:

1. En Supabase Dashboard → Authentication → Users
2. Selecciona el usuario
3. En **User Metadata**, edita el campo `role`:
   ```json
   { "role": "evaluador" }
   ```
4. Guarda. El nuevo rol aplica en el próximo login del usuario.

### Roles disponibles

| Rol | Puede crear flujos | Puede evaluar | Puede ver historial |
|-----|--------------------|---------------|---------------------|
| `admin` | Sí | Sí | Sí |
| `evaluador` | No | Sí | Sí |
| `viewer` | No | No | Sí |

---

## Recomendación de uso por dispositivo

| Tarea | Dispositivo recomendado |
|-------|------------------------|
| Sesión de evaluación interactiva (tab Evaluador) | **Desktop** — los 10 criterios con botones de puntuación requieren espacio horizontal. En mobile se muestra un aviso orientativo. |
| Consultar historial y scores de un flujo | Cualquier dispositivo |
| Revisar la rúbrica (tab Rúbrica) | Cualquier dispositivo |
| Ver distribución de pesos (tab Framework) | Cualquier dispositivo |

> La app es funcional en mobile — el banner del evaluador no bloquea el acceso, solo orienta. Dicho esto, una sesión de evaluación rigurosa se realiza mejor en un monitor donde todas las opciones y criterios son visibles sin scroll horizontal.

---

## Reglas de negocio clave

### Evaluaciones de solo lectura (append-only)

Las evaluaciones son registros permanentes del estado de un feature en un momento dado. Una vez guardada, **ninguna evaluación puede editarse ni eliminarse**, ni siquiera por un administrador desde el cliente.

Esta restricción se aplica en tres capas:
1. **UI**: no existen botones de edición ni eliminación
2. **RLS de Supabase**: no hay políticas `UPDATE` ni `DELETE` para ningún rol
3. **Función `save_evaluation`**: solo realiza `INSERT`, nunca `UPDATE`

### Cálculo del score ponderado

```
score_ponderado = Σ(puntuación_i × peso_i) / Σ(peso_i de criterios evaluados)
```

Si solo se evalúan algunos criterios, el denominador es la suma de los pesos de los criterios respondidos (no el total de 100). Esto permite evaluaciones parciales sin distorsionar el score.

### Umbrales de calidad

| Score | Interpretación |
|-------|---------------|
| ≥ 7.5 | Aprobado para producción |
| 5.0 – 7.4 | Requiere plan de mejora |
| < 5.0 | Requiere rediseño |

---

## Variables de entorno

| Variable | Descripción | Dónde obtenerla |
|----------|-------------|-----------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Clave pública anónima | Dashboard → Project Settings → API → anon / public |

Las variables con prefijo `VITE_` son expuestas al cliente por Vite. **Nunca** incluyas la `service_role` key en el frontend.

---

## Scripts disponibles

```bash
npm run dev      # servidor de desarrollo con HMR
npm run build    # build de producción → dist/
npm run preview  # preview local del build de producción
```

---

## Licencia

Uso interno. Este proyecto no es propiedad de ninguna marca comercial. Los criterios de evaluación, pesos, colores e identidad visual son propios del **UX Evaluation Framework** desarrollado por el equipo de Design & Experience.
