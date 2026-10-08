# Parte 3: Procesamiento de Flujos con Pipes & Filters

## Refactorización de Ingesta y Análisis de Activos

En esta etapa, transformaremos la manera en que la API procesa la información entrante y los reportes. En lugar de tener una lógica lineal en los servicios, implementaremos el patrón **Pipes & Filters** para construir "pipelines" de procesamiento que permitan validar, transformar y analizar los activos financieros de forma modular.

### Pasos a seguir

1. **Arquitectura del Pipeline:**
   - Diseñar una estructura donde cada **Filter** sea una clase o función independiente que realice una única operación sobre el activo.
   - Implementar un **Pipe** (o Pipeline Runner) que se encargue de ejecutar una secuencia de filtros de manera ordenada.
   - Cada filtro debe recibir un objeto, procesarlo y pasarlo al siguiente, o interrumpir el flujo si ocurre un error (**Fail-fast**).

2. **Filtros de Ingesta (Ingestion Pipeline):**
   - Al crear un nuevo activo (`POST /assets`), el objeto debe pasar por los siguientes filtros antes de ser guardado:
     - `ValidationFilter`: Verifica la estructura con Zod (ya implementado en la Parte 2, ahora como filtro).
     - `NormalizationFilter`: Transforma el símbolo a mayúsculas y elimina espacios extra.
     - `CurrencyConversionFilter`: Si el activo viene en una moneda distinta a USD, este filtro consulta una tasa y convierte el `purchasePrice`.

3. **Filtros de Análisis (Analytics Pipeline):**
   - Crear un nuevo endpoint `POST /assets/analyze` que reciba un array de activos y los pase por un pipeline de análisis:
     - `ScrubbingFilter`: Filtra activos con montos en cero o negativos.
     - `RiskAnalysisFilter`: Marca activos como `high_risk` si la volatilidad o el monto supera el umbral (Whale Alert).
     - `FormattingFilter`: Redondea los valores numéricos a dos decimales y agrega metadatos de auditoría.

4. **Logging y Observabilidad en el Pipeline:**
   - Integrar Winston o Pino para que el Pipeline registre qué filtros se han ejecutado con éxito y cuál falló en caso de error.
   - Cada filtro debe loguear su actividad: `[INFO] NormalizationFilter: Symbol BTC normalized.`

5. **Testing de Filtros:**
   - Utilizar Jest para realizar pruebas unitarias a cada filtro por separado.
   - Probar el Pipeline completo asegurando que el orden de ejecución sea el correcto.
