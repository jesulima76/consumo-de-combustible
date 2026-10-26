# Control de Consumo de Gasoil — Transporte San Diego

Aplicación web con frontend HTML/CSS/JavaScript, Google Sheets como base de datos, Google Apps Script como API y Vercel para publicar el frontend.

## 1. Archivos del proyecto

- `index.html`: interfaz y módulos.
- `styles.css`: estilos adaptables.
- `app.js`: llamadas a la API y comportamiento del frontend.
- `vercel.json`: configuración de despliegue.
- `codigo.gs`: backend que debe copiarse a Google Apps Script.
- `README.md`: estas instrucciones.

## 2. Crear la base de datos en Google Sheets

1. Cree una hoja de cálculo nueva y asígnele el nombre `Control de Consumo de Gasoil - San Diego`.
2. Copie el ID que aparece entre `/d/` y `/edit` en la URL.
3. En la hoja, cree o deje que el script cree estas pestañas: `CONSUMO`, `CHOFERES`, `VEHÍCULOS` y `COMPRAS`.
4. No cambie los nombres de las pestañas ni los encabezados que crea `setupSheets()`.

La pestaña `COMPRAS` es adicional y registra fecha, proveedor, litros, precio en USD por litro, tasa BCV e importes calculados.

## 3. Instalar Google Apps Script

1. En la hoja de cálculo, abra **Extensiones → Apps Script**.
2. Cambie el nombre del archivo inicial a `codigo.gs` (o copie todo el contenido de este proyecto dentro del archivo de script).
3. Pegue el contenido de `codigo.gs` y guarde.
4. Abra **Configuración del proyecto** (icono de engranaje) → **Propiedades del script**.
5. Añada una propiedad:
   - Propiedad: `SPREADSHEET_ID`
   - Valor: el ID de su hoja de cálculo.
6. En el selector de funciones, elija `setupSheets` y pulse **Ejecutar**.
7. Acepte los permisos solicitados. La función creará/verificará las pestañas y encabezados.

## 4. Publicar el backend como Web App

1. En Apps Script, pulse **Implementar → Nueva implementación**.
2. Seleccione tipo **Aplicación web**.
3. Descripción: `API Control Gasoil`.
4. Ejecutar como: **Yo**.
5. Quién tiene acceso: **Cualquier persona / Anyone**, si su política de cuenta permite este acceso.
6. Pulse **Implementar**, autorice si lo solicita y copie la URL que termina en `/exec`.

**Seguridad:** el acceso público significa que quien conozca la URL podría intentar leer o escribir datos. No use esta configuración con datos sensibles sin añadir autenticación y controles de acceso. En cuentas de empresa o Google Workspace, el administrador puede impedir el acceso público. No publique la URL en repositorios públicos ni redes sociales.

Cuando modifique el backend, use **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar** para actualizar la versión publicada.

## 5. Conectar el frontend con Apps Script

1. Abra `app.js`.
2. Busque esta línea:

   ```js
   const API_URL = "PEGUE_AQUI_LA_URL_DE_SU_WEB_APP_DE_APPS_SCRIPT";
   ```

3. Sustituya el texto entre comillas por la URL `/exec` que copió. Ejemplo de formato: `https://script.google.com/macros/s/IDENTIFICADOR/exec`.
4. Guarde el archivo.

El frontend envía los POST como `text/plain` con un JSON en el cuerpo para evitar la solicitud CORS preflight que suele bloquear las llamadas a Apps Script. No use la URL `/dev` para producción.

## 6. Subir a GitHub

1. Inicie sesión en GitHub y cree un repositorio, por ejemplo `control-consumo-gasoil`.
2. Para un primer despliegue sencillo, puede subir `index.html`, `styles.css`, `app.js`, `vercel.json` y `README.md`.
3. `codigo.gs` se mantiene en el editor de Apps Script. Puede guardarlo también en GitHub como respaldo, pero no se ejecuta en Vercel.
4. No suba contraseñas, tokens ni datos reales de conductores.

## 7. Desplegar en Vercel

1. Inicie sesión en Vercel y elija **Add New → Project**.
2. Importe el repositorio de GitHub.
3. Para este frontend estático no necesita comando de build ni directorio de salida especial; deje la configuración por defecto o seleccione el preset `Other`.
4. Pulse **Deploy**.
5. Cada vez que haga `push` al repositorio conectado, Vercel generará un nuevo despliegue.

## 8. Probar la API

Abra estas rutas en el navegador, sustituyendo la URL:

- `URL_EXEC?action=init`
- `URL_EXEC?action=dashboard`
- `URL_EXEC?action=choferes`
- `URL_EXEC?action=vehiculos`
- `URL_EXEC?action=consumos`
- `URL_EXEC?action=compras`

Una respuesta correcta debe incluir `{"ok":true,"data":...}`.

## 9. Cómo se calcula el consumo

- `Km Recorridos = Km Llegada - Km Salida`
- `Total Litros Tanque = Litros Iniciales + Litros Cargados`
- `Litros Consumidos = MIN(Total Litros Tanque, Km Recorridos × Factor (L/Km))`
- `Litros Restantes = Total Litros Tanque - Litros Consumidos`
- `Rendimiento (Km/L) = Km Recorridos / Litros Consumidos`

**Importante:** el factor L/Km debe ser definido y validado por la empresa según el tipo de camión y las condiciones de operación. Si el factor es cero, el sistema registra cero litros consumidos; esto evita inventar un dato. El método actual es una estimación, no una medición directa. Para un control real, conviene registrar el nivel de tanque al final del recorrido o implementar un método validado de conciliación de combustible.

## 10. Pruebas recomendadas

1. Registre un chofer con cédula única.
2. Registre un camión con placa única y factor L/Km.
3. Registre una compra y verifique los importes USD y Bs.
4. Registre un recorrido y confirme que los kilómetros y consumo calculado sean razonables.
5. Cambie el filtro de fechas y compruebe el dashboard.
6. Pruebe desde un teléfono y una computadora.

## 11. Limitaciones y mejoras antes de producción

- Esta versión es un MVP funcional para registro y consulta; no incluye edición ni eliminación de registros.
- La API pública no incorpora inicio de sesión ni roles. Para uso empresarial, se recomienda autenticación y restricción de acceso.
- Google Apps Script tiene cuotas y límites de ejecución. Si crece mucho el volumen de operaciones, considere una base de datos con permisos y auditoría.
- Los totales del dashboard suman los registros dentro del período seleccionado. Evite duplicar recorridos si se importan datos históricos.
- Las fechas de Google Sheets se normalizan con la zona horaria configurada en el proyecto de Apps Script.
