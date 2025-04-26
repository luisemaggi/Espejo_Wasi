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

    // Cargar propiedades en venta
    try {
        const rawData = await fs.readFile(path.join(homeDir, 'proyectos/espejo_wasi/datos_wasi_full.json'), 'utf-8');
        forSaleData = JSON.parse(rawData);
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
    6: "Galera"
};

// Procesar datos
async function processData() {
    const forSaleData = await loadData();

    // Seleccionar columnas relevantes
    const columns = ["id_property", "region_label", "sale_price", "id_property_type", "built_area", "created_at", "country_label"];

    // Filtrar y renombrar columnas
    const forSale = forSaleData
        .filter(item => item.country_label === "Venezuela") // Solo propiedades en Venezuela
        .map(item => {
            const filtered = {};
            columns.forEach(col => {
                if (col in item) {
                    if (col === "region_label") filtered["region"] = item[col];
                    else if (col === "sale_price") filtered["price"] = item[col];
                    else filtered[col] = item[col];
                }
            });
            filtered.id_property_type = propertyTypes[filtered.id_property_type] || filtered.id_property_type;
            filtered.built_area = parseFloat(filtered.built_area) || 0;
            filtered.price = parseFloat(filtered.price) || 0;
            filtered.price_per_sqm = filtered.built_area > 0 ? filtered.price / filtered.built_area : 0;
            if (filtered.created_at) filtered.created_at = new Date(filtered.created_at);
            return filtered;
        });

    // Identificar propiedades no vendidas después de 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
    const notSold6Months = forSale.filter(item => item.created_at && new Date(item.created_at) < sixMonthsAgo);

    // Calcular estadísticas
    const avgPricePerSqmByTypeForSale = {};
    const avgPricePerSqmByTypeNotSold = {};
    const avgPriceByRegion = {};

    // Promedio de precio por metro cuadrado por tipo (for sale)
    const forSaleByType = {};
    forSale.forEach(item => {
        if (!forSaleByType[item.id_property_type]) forSaleByType[item.id_property_type] = [];
        forSaleByType[item.id_property_type].push(item.price_per_sqm);
    });
    for (const type in forSaleByType) {
        const values = forSaleByType[type].filter(v => !isNaN(v) && v > 0);
        avgPricePerSqmByTypeForSale[type] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }

    // Promedio de precio por metro cuadrado por tipo (not sold)
    const notSoldByType = {};
    notSold6Months.forEach(item => {
        if (!notSoldByType[item.id_property_type]) notSoldByType[item.id_property_type] = [];
        notSoldByType[item.id_property_type].push(item.price_per_sqm);
    });
    for (const type in notSoldByType) {
        const values = notSoldByType[type].filter(v => !isNaN(v) && v > 0);
        avgPricePerSqmByTypeNotSold[type] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }

    // Promedio de precio por región
    const priceByRegion = {};
    forSale.forEach(item => {
        if (!priceByRegion[item.region]) priceByRegion[item.region] = [];
        priceByRegion[item.region].push(item.price);
    });
    for (const region in priceByRegion) {
        const values = priceByRegion[region].filter(v => !isNaN(v) && v > 0);
        avgPriceByRegion[region] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }

    // Contar propiedades
    const countForSale = forSale.length;
    const countNotSold = notSold6Months.length;

    return {
        forSale,
        notSold6Months,
        avgPricePerSqmByTypeForSale,
        avgPricePerSqmByTypeNotSold,
        avgPriceByRegion,
        countForSale,
        countNotSold
    };
}

// Ruta para la interfaz web
app.get('/', async (req, res) => {
    try {
        const data = await processData();
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Análisis de Mercado Inmobiliario</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; }
                    h2 { color: #555; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    a { color: #007bff; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <h1>Análisis de Mercado Inmobiliario (Venezuela)</h1>
                <h2>Estadísticas Generales</h2>
                <p>Total Propiedades en Venta: ${data.countForSale}</p>
                <p>Propiedades No Vendidas (6 meses): ${data.countNotSold}</p>

                <h2>Precio Promedio por Metro Cuadrado (En Venta)</h2>
                <table>
                    <tr><th>Tipo de Propiedad</th><th>Precio Promedio por m²</th></tr>
                    ${Object.entries(data.avgPricePerSqmByTypeForSale).map(([type, price]) => `
                        <tr><td>${type}</td><td>$${price.toFixed(2)}</td></tr>
                    `).join('')}
                </table>

                <h2>Precio Promedio por Metro Cuadrado (No Vendidas 6 Meses)</h2>
                <table>
                    <tr><th>Tipo de Propiedad</th><th>Precio Promedio por m²</th></tr>
                    ${Object.entries(data.avgPricePerSqmByTypeNotSold).map(([type, price]) => `
                        <tr><td>${type}</td><td>$${price.toFixed(2)}</td></tr>
                    `).join('')}
                </table>

                <h2>Precio Promedio por Región</h2>
                <table>
                    <tr><th>Región</th><th>Precio Promedio</th></tr>
                    ${Object.entries(data.avgPriceByRegion).map(([region, price]) => `
                        <tr><td>${region}</td><td>$${price.toFixed(2)}</td></tr>
                    `).join('')}
                </table>

                <h2>Datos Completos</h2>
                <a href="/data">Ver Datos en Formato JSON</a>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Error al procesar los datos');
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