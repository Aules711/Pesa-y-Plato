# beinghealthy

Entrenos al estilo Hevy, diario de comidas al estilo MyFitnessPal, plan semanal de comidas, progreso y vídeos de ejercicios. Web instalable en el móvil, con cuentas de usuario.

**Tecnología:** Vite (HTML + JavaScript) · Supabase (usuarios, base de datos y vídeos) · Vercel (alojamiento y la función de IA) · GitHub (código).

---

## Puesta en marcha (unos 20 minutos)

### 1. Supabase: base de datos y usuarios

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto nuevo. Región recomendada: **Europe (Frankfurt o Paris)**. Guarda la contraseña de la base de datos.
2. Ve a **SQL Editor › New query**, pega todo el contenido de `supabase/schema.sql` y pulsa **Run**. Esto crea:
   - la tabla `docs`, donde cada usuario solo ve y cambia sus datos;
   - el almacén privado `videos` para los vídeos de los ejercicios (hasta 50 MB por archivo);
   - la sincronización en vivo entre dispositivos.
3. Ve a **Project Settings › API** y copia:
   - **Project URL** → será `VITE_SUPABASE_URL`
   - **anon public key** → será `VITE_SUPABASE_ANON_KEY`

   - **service_role key** → será `SUPABASE_SERVICE_ROLE_KEY` (solo en Vercel)

   La clave `anon` es pública y puede ir en la web. La `service_role` da control total sobre tu base de datos: va **solo** en las variables de entorno de Vercel, nunca en el código, en GitHub ni con prefijo `VITE_`.

### 2. GitHub: subir el código

1. Crea un repositorio nuevo en GitHub (puede ser privado), por ejemplo `pesa-y-plato`.
2. Sube esta carpeta tal cual, **sin** `node_modules`, `dist` ni `.env` (el `.gitignore` ya los excluye). Puedes hacerlo con:
   ```bash
   git init
   git add .
   git commit -m "Primera versión de beinghealthy"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/pesa-y-plato.git
   git push -u origin main
   ```
   O, sin terminal: en GitHub, «Add file › Upload files» y arrastra el contenido de la carpeta.

### 3. Vercel: publicar la web

1. Entra en [vercel.com](https://vercel.com) con tu cuenta de GitHub, pulsa **Add New › Project** e importa el repositorio.
2. Vercel detecta Vite solo. En **Environment Variables** añade:

   | Nombre | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | tu Project URL |
   | `VITE_SUPABASE_ANON_KEY` | tu anon public key |
   | `VITE_ALLOW_SIGNUP` | `true` (la gente crea su propia cuenta con su email) |
   | `VITE_INVITE_REQUIRED` | `false` (cualquiera puede registrarse; `true` si algún día quieres limitarlo a invitados) |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clave **service_role** de Supabase (Project Settings › API). Solo aquí, nunca en el código: permite que cada usuario elimine su cuenta |
   | `VITE_AI_ENABLED` | `false` (o `true` si activas la IA, paso 5) |

3. Pulsa **Deploy**. En un minuto tendrás una dirección tipo `pesa-y-plato.vercel.app`.

### 4. Conectar Supabase con tu web

En Supabase, **Authentication › URL Configuration**:
- **Site URL:** `https://pesa-y-plato.vercel.app` (tu dirección real).
- **Redirect URLs:** añade la misma dirección y `http://localhost:5173` para probar en tu ordenador.

Sin esto, los emails de confirmar cuenta y cambiar contraseña llevarían a una dirección equivocada.

Recomendado en **Authentication › Emails**: cambia los textos de los emails a español. El servicio de email gratuito de Supabase envía muy pocos correos por hora; antes de abrirla al público, configura un SMTP propio (por ejemplo Resend o Brevo) en **Authentication › SMTP Settings**.

### 5. (Opcional) Estimación de comidas con IA

La pestaña «Con IA» del diario usa la API de Anthropic y **cuesta dinero por uso** (céntimos por cada estimación con un modelo pequeño).

1. Crea una clave en [console.anthropic.com](https://console.anthropic.com) y ponle un límite de gasto mensual.
2. En Vercel › Settings › Environment Variables añade:
   - `ANTHROPIC_API_KEY` = tu clave (**sin** prefijo `VITE_`, así nunca llega al navegador)
   - `ANTHROPIC_MODEL` = `claude-haiku-5-5` (opcional; es el valor por defecto)
   - cambia `VITE_AI_ENABLED` a `true`
3. Vuelve a desplegar (Deployments › ⋯ › Redeploy).

La función `api/estimate.js` solo responde a usuarios con sesión iniciada y limita a 8 consultas por minuto y usuario.

---

## (Opcional) Limitar el registro a invitados

Por defecto la web está **abierta a todo el mundo**. Si alguna vez quieres que solo se registre quien tenga un código tuyo (por ejemplo, para una fase de pruebas con amigos), pon `VITE_INVITE_REQUIRED=true` y sigue estos pasos. Cada persona crea su cuenta con **su email y su contraseña**, pero necesita un **código de invitación**. Cada código vale para una persona y se gasta al usarlo.

1. **Activar los códigos:** en Supabase › SQL Editor, pega y ejecuta `supabase/invitaciones.sql` (después de `schema.sql`). Desde ese momento Supabase rechaza cualquier registro sin un código válido, aunque alguien intente saltarse la app.
2. **Crear códigos:** en ese mismo archivo, la parte «CREAR CÓDIGOS» genera uno por persona. Cambia `'Amigo 1', 'Amigo 2'…` por sus nombres, ejecútala y te saldrá la lista de códigos (tipo `7F3A-C91B`). La columna `uses` te dice cuáles se han usado.
3. **Invitar:** pásale a cada amigo, por privado, el enlace de la web y su código. Él entra, pulsa **Crear cuenta**, pone su email, su contraseña y el código, y confirma desde el email que le llega.
4. **Quitar el acceso a alguien:** Authentication › Users › ⋯ › **Delete user**. Se borran también todos sus datos. Sus vídeos se quedan en Storage › videos › (su id); bórralos a mano si quieres.

**Emails de confirmación:** el servicio de email que trae Supabase gratis solo envía unos pocos emails por hora. Si invitas a varios amigos el mismo día, algunos no recibirán el email de confirmación. Dos soluciones:
- **Recomendada:** configura un SMTP gratuito (por ejemplo [Resend](https://resend.com) o Brevo) en Authentication › SMTP Settings.
- **Rápida:** en Authentication › Sign In / Providers › Email, desactiva **Confirm email**. El código de invitación ya hace de filtro, así que para un grupo de amigos es aceptable.

**Si das de alta a alguien a mano** (Authentication › Users › Add user): añade antes su email como código para que el control lo deje pasar:
`insert into public.invite_codes (code, note) values ('su@email.com', 'Nombre');`

**Abrirla a todo el mundo más adelante:** pon `VITE_INVITE_REQUIRED=false`, redespliega y ejecuta en Supabase `drop trigger if exists check_invite on auth.users;`.

Cada persona solo ve sus propios datos aunque compartáis la misma web. Tú, como administrador, puedes verlo todo desde el panel de Supabase: díselo a tus amigos.

---

## Premium (escáner de códigos de barras)

El escáner es Premium: 3 € al mes por Bizum. Como Bizum no permite cobrar automáticamente desde una web, el cobro es manual.

1. **Crear la tabla:** en Supabase › SQL Editor, ejecuta `supabase/premium.sql`.
2. **Variables en Vercel** (Settings › Environment Variables, tipo *Secret*, y después Redeploy):
   - `ADMIN_EMAILS` = tu email de la app (el que usas para entrar). Varios, separados por comas.
   - `BIZUM_PHONE` = el número al que te pagan.
   - `PREMIUM_PRICE` = `3` (opcional).
   - `SUPABASE_SERVICE_ROLE_KEY` (ya lo tienes del paso 4).
3. **Cómo funciona:**
   - Quien no tiene Premium ve el precio, tu número y el concepto que debe poner («Premium su@email.com»), con botones para copiarlos.
   - Cuando te llegue un Bizum, entra en **Perfil › Panel de administración**, busca el email del concepto y pulsa **+1 mes**. Si ya tenía Premium, se suma al mes que le quedara.
   - **Regalar** da Premium para siempre a quien tú quieras. **Quitar** lo retira.
   - El panel solo lo ven los emails de `ADMIN_EMAILS`; la función lo comprueba en el servidor.

Tu número y tu email de administrador no están en el código: van en variables de Vercel, así que puedes tener el repositorio público. El número solo lo ven las personas con sesión iniciada, en la pantalla de Premium.

**Ojo:** si cobras, la web pasa a ser un proyecto comercial. El plan gratuito de Vercel (Hobby) no lo permite; necesitarías Vercel Pro. Y los ingresos hay que declararlos.

## Pasar tus datos desde la versión de Claude

1. En la app de Claude: **Perfil › Exportar › Copia completa (.json)**.
2. En la nueva web, entra con tu cuenta: **Perfil › Importar › Copia de seguridad (.json)**.

Pasan entrenos, comidas, rutinas, ejercicios, peso y ajustes. Los **vídeos no viajan** en la copia: vuelve a subirlos desde la ficha de cada ejercicio.


## Instalarla en el móvil

- **iPhone:** abre la web en Safari › botón Compartir › «Añadir a pantalla de inicio».
- **Android:** Chrome › menú › «Instalar aplicación».

## Trabajar en tu ordenador

```bash
npm install
cp .env.example .env    # y rellena tus claves
npm run dev             # abre http://localhost:5173
```

Cada `git push` a `main` vuelve a publicar la web en Vercel automáticamente.

## Estructura

```
index.html              estructura de la app
src/main.js             toda la lógica (entrenos, diario, progreso, importar…)
src/style.css           diseño (modo claro y oscuro)
api/estimate.js         función de Vercel para la IA (opcional)
api/delete-account.js   función de Vercel para que cada usuario elimine su cuenta
api/admin.js            función de Vercel para Premium y el panel de administración
supabase/schema.sql     tablas, permisos y almacén de vídeos
supabase/invitaciones.sql  registro solo con código de invitación
supabase/premium.sql    tabla de Premium
public/                 iconos, manifest y páginas legales (privacidad.html, terminos.html)
```

## Antes de abrirla al público (obligatorio)

1. **Rellena las páginas legales:** `public/privacidad.html` y `public/terminos.html` son plantillas. Completa todo lo que aparece resaltado (tu nombre, NIF, email de contacto, región de Supabase, proveedor de email, fecha). Al registrarse, cada usuario tiene que aceptarlas y dar su consentimiento expreso para sus datos de salud: la app ya lo pide y guarda la fecha. Son una base razonable, pero no soy abogado: si la app crece o vas a ganar dinero con ella, que las revise un profesional.
2. **Configura un email propio (SMTP):** el email gratuito de Supabase solo envía unos pocos correos por hora y la gente no podría confirmar su cuenta. Usa uno gratuito como [Resend](https://resend.com) o Brevo en Authentication › SMTP Settings, y traduce los textos de los emails en Authentication › Emails.
3. **Activa el borrado de cuenta:** añade `SUPABASE_SERVICE_ROLE_KEY` en Vercel. Sin ella, el botón «Eliminar mi cuenta» avisa de que no está configurado.
4. **Activa la protección de contraseñas:** en Supabase › Authentication › Sign In / Providers › Email, sube la longitud mínima de contraseña a 8 y activa «Leaked password protection» si tu plan lo permite.
5. **Elige región europea** al crear el proyecto de Supabase (ya lo dice el paso 1): lo exige en la práctica el tratamiento de datos de salud.

## Costes y límites al crecer

- **Supabase gratis:** 500 MB de base de datos, 1 GB de archivos y 50.000 usuarios activos al mes. Los **vídeos** son lo que antes se llena: con mucha gente subiendo vídeos tendrás que pasar al plan Pro (unos 25 $/mes) o bajar el tamaño máximo (`MAX_VIDEO_MB` en `src/main.js` y `file_size_limit` en `schema.sql`). En el plan gratuito el proyecto se pausa tras una semana sin uso.
- **Vercel Hobby (gratis):** sirve para proyectos personales y **no comerciales**. Si pones anuncios, suscripciones o cobras por la app, necesitas Vercel Pro.
- **IA:** cada estimación cuesta dinero de tu cuenta de Anthropic. Con la web abierta, déjala desactivada hasta que tengas usuarios y pon un límite de gasto mensual en console.anthropic.com. La función ya limita a 5 consultas por minuto y usuario.
