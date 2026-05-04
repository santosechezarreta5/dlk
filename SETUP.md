# SETUP — Supabase + GitHub Pages

Esta guía te lleva de cero a tener la app desplegada en GitHub Pages
con catálogo compartido en Supabase. Tiempo estimado: **15 minutos**.

---

## Parte 1 — Supabase (10 min)

### 1.1) Crear proyecto

1. Ir a https://supabase.com y registrarte (free tier alcanza sobrado).
2. Click en **"New Project"**.
3. Nombre: `bonosdl-ar` (o el que quieras). Región: **South America (São Paulo)**.
4. Generá una password para la base de datos. Guardala — no la vamos a usar
   para la app, pero te puede servir si querés conectarte directo con `psql`.
5. Esperá ~2 minutos a que se aprovisione.

### 1.2) Correr la migración SQL

1. En el sidebar del dashboard, ir a **SQL Editor** → **New Query**.
2. Abrir el archivo `supabase_migration.sql` que viene con el proyecto.
3. Copiar TODO el contenido y pegarlo en el editor SQL.
4. Click **Run** (botón verde abajo a la derecha).
5. Debería decir algo como `Success. 64 rows affected` o similar.

✅ Esto crea la tabla `bonds`, las políticas de seguridad (RLS) y carga los 64 bonos.

### 1.3) Crear usuario admin

1. En el sidebar: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Email: el tuyo.
3. Password: una segura, **guardala**.
4. **DESMARCAR** "Auto Confirm User" si está marcado, o marcalo si querés
   evitar el mail de confirmación. Mejor marcarlo (más rápido).
5. Click **Create user**.

✅ Ya podés iniciar sesión con ese email y password desde la app.

### 1.4) Obtener URL y anon key

1. **Project Settings** (engranaje abajo a la izquierda) → **API**.
2. Copiar:
   - **Project URL** → ej: `https://xxxxxxxxxxxxxxx.supabase.co`
   - **anon public key** (la corta, NO la `service_role`) → ej: `eyJhbGciOiJI...`

⚠️ **Importante**: La `anon public` es para usar en el frontend, es segura
porque las políticas RLS impiden escritura sin autenticación.
**NUNCA** pongas la `service_role` en el frontend.

---

## Parte 2 — Configurar el HTML (1 min)

1. Abrí `index.html` en un editor de texto.
2. Buscar en la línea ~331 el bloque:

   ```js
   window.SUPABASE_CONFIG = {
     url: '',
     anonKey: ''
   };
   ```

3. Pegar la URL y la anon key:

   ```js
   window.SUPABASE_CONFIG = {
     url: 'https://xxxxxxxxxxxxxxx.supabase.co',
     anonKey: 'eyJhbGciOiJI...'
   };
   ```

4. Guardar.

---

## Parte 3 — GitHub Pages (5 min)

### 3.1) Subir el código a GitHub

```bash
cd bonosdl_v1
git init
git add index.html supabase_migration.sql SETUP.md CHECKPOINT.md
git commit -m "BonosCorp DL v2 — Supabase integration"
git branch -M main
# Crear el repo en github.com (público o privado)
git remote add origin https://github.com/<TU_USER>/<TU_REPO>.git
git push -u origin main
```

### 3.2) Activar GitHub Pages

1. En tu repo en github.com → **Settings** → **Pages**.
2. **Source**: Deploy from a branch.
3. **Branch**: `main` / root (`/`).
4. Click **Save**.
5. Esperá ~1 minuto. El link aparece arriba: `https://<user>.github.io/<repo>/`.

✅ Ya podés compartir ese link con tus compañeros.

---

## Parte 4 — Probar el flujo

### Como usuario común (sin login):
1. Abrir el link de GitHub Pages.
2. Ver los 64 bonos.
3. Click en cualquier bono → ver flujos de caja.
4. Editar precios manualmente, override A3500, alertas → todo se guarda
   en LocalStorage (cada usuario su versión).

### Como admin (vos):
1. Click en **🔒 Admin** (esquina superior derecha).
2. Ingresar email y password que creaste en 1.3.
3. Aparece **✓ tu-email** verde, y se habilitan:
   - Botón **+ Nuevo bono**
   - Botón **✏️ Editar** en el panel calc
   - Botón **✕** al hover sobre cualquier bono (eliminar)
4. Cambios → se guardan en Supabase → todos los demás los ven en vivo (realtime).

### Logout:
- Click sobre **✓ tu-email** → confirmar → vuelve a modo lectura.

---

## Sobre los archivos del proyecto

| Archivo | ¿Necesario en producción (GitHub Pages)? |
|---------|------------------------------------------|
| `index.html` | ✅ Sí — es la app |
| `supabase_migration.sql` | ❌ No — solo se corre una vez en Supabase |
| `SETUP.md` | ❌ No — esta guía |
| `CHECKPOINT.md` | ❌ No — historial técnico |
| `server.js` | ❌ No — solo si querés correr local sin Supabase |
| `package.json` | ❌ No — solo si usás server.js |
| `bonos_template.xlsx` | ⚠️ Opcional — para importar bonos masivamente |

Para GitHub Pages, lo único que **tiene** que estar deployado es `index.html`.
Los demás los podés tener en el repo pero no son necesarios.

---

## Troubleshooting

### "Sin Supabase configurado" en la consola
- Verificá que pegaste URL y anon key correctamente en la línea 331.
- Probá hacer hard refresh (Ctrl+Shift+R).

### Login falla con "Invalid login credentials"
- Verificá email y password en Supabase Authentication → Users.
- Si creaste el usuario sin auto-confirm, fijate en tu inbox un mail de
  confirmación.

### Cambios del admin no llegan a otros usuarios en vivo
- Verificá en Supabase: Database → Replication → Source → tabla `bonds` debe
  estar en la publication `supabase_realtime`. La migración la agrega
  automáticamente.

### Error CORS al llamar a data912
- No debería pasar — data912 envía `Access-Control-Allow-Origin: *`.
- Si pasa, abrí un issue.

---

## Costos

- **Supabase free tier**: 500MB DB, 2GB bandwidth/mes, hasta 50K usuarios
  autenticados/mes. Sobra ampliamente para 5-20 personas en una oficina.
- **GitHub Pages**: gratis para repos públicos. Privados: 1GB en plan free.

Todo gratis para tu uso.
