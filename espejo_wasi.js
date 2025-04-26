const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 5001;

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Cargar los datos
async function loadData() {
    const homeDir = process.env.HOME;
    let forSaleData;

    try {
        const rawData = await fs.readFile(path.join(homeDir, 'proyectos/espejo_wasi/datos_wasi_full.json'), 'utf-8');
        forSaleData = JSON.parse(rawData);
        console.log(`Total de registros cargados: ${forSaleData.length}`);
    } catch (error) {
        console.error('Error al cargar datos_wasi_full.json:', error.message);
        forSaleData = [];
    }

    return forSaleData;
}

// Mapear tipos de propiedad
const propertyTypes = {
    1: "Apartamento",
    2: "Casa",
    3: "Oficina",
    4: "Local Comercial",
    5: "Terreno",
    6: "Galpón"
};

// Función para limpiar y convertir valores a número
function parseNumber(value) {
    if (!value) return 0;
    const strValue = String(value);
    const cleaned = strValue.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

// Procesar datos
async function processData() {
    const forSaleData = await loadData();

    if (!forSaleData || forSaleData.length === 0) {
        console.log('No se encontraron datos en datos_wasi_full.json');
        return {
            forSale: [],
            validForSale: [],
            forSaleUnder6Months: [],
            notSold6Months: [],
            notSold9Months: [],
            avgPricePerSqmByTypeUnder6Months: {},
            avgPricePerSqmByTypeNotSold6Months: {},
            avgPricePerSqmByTypeNotSold9Months: {},
            avgPricePerSqmByRegionAndType: {},
        };
    }

    // Seleccionar columnas relevantes
    const columns = [
        "id_property",
        "region_label",
        "sale_price",
        "sale_price_label",
        "price",
        "original_price",
        "for_sale",
        "id_property_type",
        "area",
        "built_area",
        "private_area",
        "total_area",
        "land_area",
        "created_at",
        "country_label"
    ];

    // Filtrar y renombrar columnas
    let forSale = forSaleData
        .filter(item => item.country_label === "Venezuela" && item.for_sale === "true")
        .map(item => {
            const filtered = {};
            columns.forEach(col => {
                if (col in item) {
                    if (col === "region_label") filtered["region"] = item[col];
                    else filtered[col] = item[col];
                }
            });

            // Mapear el tipo de propiedad
            const originalType = filtered.id_property_type;
            filtered.id_property_type = propertyTypes[filtered.id_property_type] || filtered.id_property_type;
            if (!propertyTypes[originalType]) {
                console.log(`Tipo de propiedad no mapeado para id_property ${filtered.id_property}: id_property_type = ${originalType}`);
            }

            // Obtener todos los campos de área y calcular el máximo
            const areas = [
                parseNumber(filtered.area),
                parseNumber(filtered.built_area),
                parseNumber(filtered.private_area),
                parseNumber(filtered.total_area),
                parseNumber(filtered.land_area)
            ].filter(val => val > 0);
            filtered.max_area = areas.length > 0 ? Math.max(...areas) : 0;
            if (filtered.max_area <= 0) {
                console.log(`Área inválida para id_property ${filtered.id_property}: area = ${filtered.area}, built_area = ${filtered.built_area}, private_area = ${filtered.private_area}, total_area = ${filtered.total_area}, land_area = ${filtered.land_area}`);
            }

            // Obtener todos los campos de precio y calcular el máximo
            const prices = [
                parseNumber(filtered.sale_price),
                parseNumber(filtered.sale_price_label),
                parseNumber(filtered.price),
                parseNumber(filtered.original_price)
            ].filter(val => val > 0);
            filtered.price = prices.length > 0 ? Math.max(...prices) : 0;
            if (filtered.price <= 0) {
                console.log(`Precio inválido para id_property ${filtered.id_property}: sale_price = ${filtered.sale_price}, sale_price_label = ${filtered.sale_price_label}, price = ${filtered.price}, original_price = ${filtered.original_price}, parsed prices = ${prices}`);
            }

            // Calcular price_per_sqm
            filtered.price_per_sqm = (filtered.max_area > 0 && filtered.price > 0) ? filtered.price / filtered.max_area : 0;
            if (filtered.price_per_sqm > 0) {
                console.log(`price_per_sqm calculado para id_property ${filtered.id_property}: price = ${filtered.price}, max_area = ${filtered.max_area}, price_per_sqm = ${filtered.price_per_sqm}`);
            }

            filtered.hasValidArea = filtered.max_area > 0;
            filtered.hasValidPrice = filtered.price > 0;
            if (filtered.created_at) filtered.created_at = new Date(filtered.created_at);
            return filtered;
        });

    // Filtrar solo los inmuebles con max_area y precio válidos
    const validForSale = forSale.filter(item => item.hasValidArea && item.hasValidPrice);
    console.log(`Propiedades válidas para cálculos (con área y precio válidos): ${validForSale.length}`);

    // Identificar propiedades por tiempo de creación
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
    const nineMonthsAgo = new Date();
    nineMonthsAgo.setDate(nineMonthsAgo.getDate() - 270);

    const forSaleUnder6Months = validForSale.filter(item => item.created_at && new Date(item.created_at) >= sixMonthsAgo);
    const notSold6Months = validForSale.filter(item => item.created_at && new Date(item.created_at) < sixMonthsAgo);
    const notSold9Months = validForSale.filter(item => item.created_at && new Date(item.created_at) < nineMonthsAgo);

    // Calcular estadísticas
    const avgPricePerSqmByTypeUnder6Months = {};
    const avgPricePerSqmByTypeNotSold6Months = {};
    const avgPricePerSqmByTypeNotSold9Months = {};
    const avgPricePerSqmByRegionAndType = {};

    // Inicializar los promedios para cada tipo de propiedad
    Object.values(propertyTypes).forEach(type => {
        avgPricePerSqmByTypeUnder6Months[type] = 0;
        avgPricePerSqmByTypeNotSold6Months[type] = 0;
        avgPricePerSqmByTypeNotSold9Months[type] = 0;
    });

    // Promedio de precio por metro cuadrado por tipo (en venta < 6 meses)
    const forSaleUnder6MonthsByType = {};
    forSaleUnder6Months.forEach(item => {
        if (!forSaleUnder6MonthsByType[item.id_property_type]) forSaleUnder6MonthsByType[item.id_property_type] = [];
        if (item.price_per_sqm > 0 && !isNaN(item.price_per_sqm)) {
            forSaleUnder6MonthsByType[item.id_property_type].push(item.price_per_sqm);
        }
    });
    for (const type in forSaleUnder6MonthsByType) {
        const values = forSaleUnder6MonthsByType[type].filter(v => !isNaN(v) && v > 0);
        avgPricePerSqmByTypeUnder6Months[type] = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
        console.log(`Promedio price_per_sqm para ${type} (< 6 meses): ${avgPricePerSqmByTypeUnder6Months[type]}, basado en ${values.length} propiedades`);
    }

    // Promedio de precio por metro cuadrado por tipo (no vendidas > 6 meses)
    const notSold6MonthsByType = {};
    notSold6Months.forEach(item => {
        if (!notSold6MonthsByType[item.id_property_type]) notSold6MonthsByType[item.id_property_type] = [];
        if (item.price_per_sqm > 0 && !isNaN(item.price_per_sqm)) {
            notSold6MonthsByType[item.id_property_type].push(item.price_per_sqm);
        }
    });
    for (const type in notSold6MonthsByType) {
        const values = notSold6MonthsByType[type].filter(v => !isNaN(v) && v > 0);
        avgPricePerSqmByTypeNotSold6Months[type] = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
        console.log(`Promedio price_per_sqm para ${type} (> 6 meses): ${avgPricePerSqmByTypeNotSold6Months[type]}, basado en ${values.length} propiedades`);
    }

    // Promedio de precio por metro cuadrado por tipo (no vendidas > 9 meses)
    const notSold9MonthsByType = {};
    notSold9Months.forEach(item => {
        if (!notSold9MonthsByType[item.id_property_type]) notSold9MonthsByType[item.id_property_type] = [];
        if (item.price_per_sqm > 0 && !isNaN(item.price_per_sqm)) {
            notSold9MonthsByType[item.id_property_type].push(item.price_per_sqm);
        }
    });
    for (const type in notSold9MonthsByType) {
        const values = notSold9MonthsByType[type].filter(v => !isNaN(v) && v > 0);
        avgPricePerSqmByTypeNotSold9Months[type] = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
        console.log(`Promedio price_per_sqm para ${type} (> 9 meses): ${avgPricePerSqmByTypeNotSold9Months[type]}, basado en ${values.length} propiedades`);
    }

    // Promedio de precio por metro cuadrado por región y tipo de propiedad
    const pricePerSqmByRegionAndType = {};
    validForSale.forEach(item => {
        if (!pricePerSqmByRegionAndType[item.region]) pricePerSqmByRegionAndType[item.region] = {};
        if (!pricePerSqmByRegionAndType[item.region][item.id_property_type]) pricePerSqmByRegionAndType[item.region][item.id_property_type] = [];
        if (item.price_per_sqm > 0 && !isNaN(item.price_per_sqm)) {
            pricePerSqmByRegionAndType[item.region][item.id_property_type].push(item.price_per_sqm);
        }
    });
    for (const region in pricePerSqmByRegionAndType) {
        avgPricePerSqmByRegionAndType[region] = {};
        for (const type in pricePerSqmByRegionAndType[region]) {
            const values = pricePerSqmByRegionAndType[region][type].filter(v => !isNaN(v) && v > 0);
            avgPricePerSqmByRegionAndType[region][type] = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
            console.log(`Promedio price_per_sqm para ${region} - ${type}: ${avgPricePerSqmByRegionAndType[region][type]}, basado en ${values.length} propiedades`);
        }
    }

    return {
        forSale,
        validForSale,
        forSaleUnder6Months,
        notSold6Months,
        notSold9Months,
        avgPricePerSqmByTypeUnder6Months,
        avgPricePerSqmByTypeNotSold6Months,
        avgPricePerSqmByTypeNotSold9Months,
        avgPricePerSqmByRegionAndType,
    };
}

// Función para formatear números con separadores de miles y sin decimales
function formatNumber(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Ruta para la interfaz web
app.get('/', async (req, res) => {
    try {
        const data = await processData();

        // Verificar si hay datos suficientes para las gráficas y la tabla
        const hasDataForTypeChart = Object.values(data.avgPricePerSqmByTypeUnder6Months).some(val => val > 0) ||
            Object.values(data.avgPricePerSqmByTypeNotSold6Months).some(val => val > 0) ||
            Object.values(data.avgPricePerSqmByTypeNotSold9Months).some(val => val > 0);

        const hasDataForRegionChart = Object.values(data.avgPricePerSqmByRegionAndType).some(region =>
            Object.values(region).some(val => val > 0)
        );

        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Análisis de Mercado Inmobiliario</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; }
                    h2 { color: #555; }
                    a { color: #007bff; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    canvas { max-width: 800px; margin: 20px 0; }
                    .no-data { color: #ff0000; font-style: italic; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; table-layout: fixed; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                    th { background-color: #f2f2f2; width: 14.28%; }
                    td:first-child { width: 14.28%; }
                </style>
            </head>
            <body>
                <h1>Análisis de Mercado Inmobiliario (Venezuela)</h1>

                <h2>Precio Promedio por Metro Cuadrado por Tipo de Inmueble</h2>
                ${hasDataForTypeChart ? `
                <canvas id="priceChart"></canvas>
                <script>
                    const ctx = document.getElementById('priceChart').getContext('2d');
                    const forSaleUnder6MonthsData = ${JSON.stringify(Object.values(data.avgPricePerSqmByTypeUnder6Months))};
                    const notSold6MonthsData = ${JSON.stringify(Object.values(data.avgPricePerSqmByTypeNotSold6Months))};
                    const notSold9MonthsData = ${JSON.stringify(Object.values(data.avgPricePerSqmByTypeNotSold9Months))};
                    const labels = ${JSON.stringify(Object.values(propertyTypes))};

                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [
                                {
                                    label: 'En Venta (< 6 Meses)',
                                    data: forSaleUnder6MonthsData,
                                    backgroundColor: 'rgba(0, 128, 0, 0.5)', // Verde
                                    borderColor: 'rgba(0, 128, 0, 1)',
                                    borderWidth: 1
                                },
                                {
                                    label: 'No Vendidas (> 6 Meses)',
                                    data: notSold6MonthsData,
                                    backgroundColor: 'rgba(255, 255, 0, 0.5)', // Amarillo
                                    borderColor: 'rgba(255, 255, 0, 1)',
                                    borderWidth: 1
                                },
                                {
                                    label: 'No Vendidas (> 9 Meses)',
                                    data: notSold9MonthsData,
                                    backgroundColor: 'rgba(255, 0, 0, 0.5)', // Rojo
                                    borderColor: 'rgba(255, 0, 0, 1)',
                                    borderWidth: 1
                                }
                            ]
                        },
                        options: {
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    title: {
                                        display: true,
                                        text: 'Precio Promedio por m² ($)'
                                    },
                                    ticks: {
                                        callback: function(value) {
                                            return '$' + value.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
                                        }
                                    }
                                },
                                x: {
                                    title: {
                                        display: true,
                                        text: 'Tipo de Propiedad'
                                    }
                                }
                            },
                            plugins: {
                                legend: {
                                    position: 'top'
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            let label = context.dataset.label || '';
                                            if (label) {
                                                label += ': ';
                                            }
                                            label += '$' + context.parsed.y.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
                                            return label;
                                        }
                                    }
                                }
                            }
                        }
                    });
                </script>
                ` : `<p class="no-data">No hay datos suficientes para generar la gráfica de tipos. Verifique los datos en datos_wasi_full.json (asegúrese de que for_sale sea "true", al menos uno de los campos de área sea mayor a 0, y que al menos uno de los campos de precio sea mayor a 0).</p>`}

                <h2>Precio Promedio por Metro Cuadrado por Región y Tipo de Propiedad (Gráfica)</h2>
                ${hasDataForRegionChart ? `
                <canvas id="regionChart"></canvas>
                <script>
                    const regionCtx = document.getElementById('regionChart').getContext('2d');
                    const regions = ${JSON.stringify(Object.keys(data.avgPricePerSqmByRegionAndType))};
                    const propertyTypes = ${JSON.stringify(Object.values(propertyTypes))};
                    const colors = [
                        'rgba(54, 162, 235, 0.5)',  // Azul
                        'rgba(255, 99, 132, 0.5)',  // Rosa
                        'rgba(75, 192, 192, 0.5)',  // Verde azulado
                        'rgba(153, 102, 255, 0.5)', // Púrpura
                        'rgba(255, 159, 64, 0.5)',  // Naranja
                        'rgba(199, 199, 199, 0.5)'  // Gris
                    ];
                    const borderColors = [
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(199, 199, 199, 1)'
                    ];

                    const datasets = propertyTypes.map((type, index) => {
                        const dataForType = regions.map(region => {
                            return data.avgPricePerSqmByRegionAndType[region][type] || 0;
                        });
                        return {
                            label: type,
                            data: dataForType,
                            backgroundColor: colors[index % colors.length],
                            borderColor: borderColors[index % borderColors.length],
                            borderWidth: 1
                        };
                    });

                    new Chart(regionCtx, {
                        type: 'bar',
                        data: {
                            labels: regions,
                            datasets: datasets
                        },
                        options: {
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    title: {
                                        display: true,
                                        text: 'Precio Promedio por m² ($)'
                                    },
                                    ticks: {
                                        callback: function(value) {
                                            return '$' + value.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
                                        }
                                    }
                                },
                                x: {
                                    title: {
                                        display: true,
                                        text: 'Región'
                                    }
                                }
                            },
                            plugins: {
                                legend: {
                                    position: 'top'
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            let label = context.dataset.label || '';
                                            if (label) {
                                                label += ': ';
                                            }
                                            label += '$' + context.parsed.y.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
                                            return label;
                                        }
                                    }
                                }
                            }
                        }
                    });
                </script>
                ` : `<p class="no-data">No hay datos suficientes para generar la gráfica de regiones. Verifique los datos en datos_wasi_full.json (asegúrese de que for_sale sea "true", al menos uno de los campos de área sea mayor a 0, y que al menos uno de los campos de precio sea mayor a 0).</p>`}

                <h2>Precio Promedio por Metro Cuadrado por Región y Tipo de Propiedad (Tabla)</h2>
                ${Object.keys(data.avgPricePerSqmByRegionAndType).length > 0 ? `
                <table>
                    <tr>
                        <th>Región</th>
                        ${Object.values(propertyTypes).map(type => `<th>${type}</th>`).join('')}
                    </tr>
                    ${Object.entries(data.avgPricePerSqmByRegionAndType).map(([region, types]) => `
                        <tr>
                            <td>${region}</td>
                            ${Object.values(propertyTypes).map(type => `
                                <td>$${formatNumber(types[type] || 0)}</td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </table>
                ` : `<p class="no-data">No hay datos suficientes para generar la tabla de regiones. Verifique los datos en datos_wasi_full.json (asegúrese de que for_sale sea "true", al menos uno de los campos de área sea mayor a 0, y que al menos uno de los campos de precio sea mayor a 0).</p>`}

                <h2>Datos Completos</h2>
                <a href="/data">Ver Datos en Formato JSON</a>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error al procesar los datos:', error.message);
        res.status(500).send(`Error al procesar los datos: ${error.message}`);
    }
});

// Ruta para los datos en JSON
app.get('/data', async (req, res) => {
    try {
        const data = await processData();
        res.json(data.forSale);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los datos' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});