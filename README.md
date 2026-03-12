# sayhueque-gerencial

Dashboard gerencial de Say Hueque — Next.js 14 + Supabase + Vercel.

## Stack

- **Next.js 14** (App Router, Server Components)
- **Supabase** (auth + base de datos + RLS)
- **Vercel** (deploy)
- **SheetJS** (parser del Excel)

## Setup rápido

### 1. Clonar y instalar

```bash
git clone https://github.com/TU_ORG/sayhueque-gerencial.git
cd sayhueque-gerencial
npm install
```

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Completar con los valores de **Supabase → Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Base de datos Supabase

Correr el archivo `supabase_schema.sql` en **Supabase → SQL Editor → Run**.

### 4. Crear primer usuario admin

En Supabase → Authentication → Users → Invite user.
Luego en Table Editor → profiles → editar el registro y cambiar `role` a `admin`.

### 5. Dev local

```bash
npm run dev
```

### 6. Deploy en Vercel

```bash
# Conectar repo en vercel.com → New Project
# Agregar las 3 variables de entorno en Vercel → Settings → Environment Variables
```

---

## Flujo de datos

```
Excel (.xlsm)  →  /api/upload  →  Parser (src/lib/parser.ts)  →  Supabase
                                         ↓
                              Replica las reglas de los macros VBA:
                              • Team Leader (fila 9)
                              • Bookings Audit (fila 7)
                              • Files B2C SaleForce (fila 1)
                              • Temp 2425 / Temp 2425 Venta / Temp 2425 cantidad
```

## Hojas procesadas del Excel

| Hoja | Encabezado | Qué se extrae |
|---|---|---|
| Reporte Team Leader | Fila 9 | File, Vendedor, Operador, Cliente, Venta, Costo, etc. |
| Bookings Audit | Fila 7 | QU→OK, fechas, áreas, operadores |
| Files B2C SaleForce | Fila 1 | Venta/Ganancia SF para WE/PL/WI |
| Temp 2425 | Fila 1 | Ganancia histórica 24/25 por área y mes |
| Temp 2425 Venta | Fila 1 | Venta histórica 24/25 |
| Temp 2425 cantidad | Fila 1 | Cantidad histórica 24/25 |

## Páginas

| Ruta | Descripción |
|---|---|
| `/dashboard` | Resumen ejecutivo + KPIs |
| `/confirmaciones` | CP1: QU→OK últimos 7 días |
| `/temporada` | CP2: foto temporada (terminados/en curso/futuros) |
| `/comparativo` | CP3: 24/25 vs 25/26 mes a mes |
| `/web-vs-sf` | Web vs Salesforce B2C |
| `/vendedores` | Ranking de vendedores |
| `/clientes` | Análisis de clientes |
| `/contribucion` | CP5: muestra CM por área |
| `/subir` | Upload del Excel |
| `/admin` | Gestión de usuarios (solo admin) |
