const axios = require('axios');
const fs = require('fs');

const ID_COMPANY = '21730098';
const WASI_TOKEN = 'Y3vR_nV5K_WHkR_JH8t';
const TAKE = 50;

async function obtenerTodosLosDatosWasi() {
    console.log('Directorio de trabajo actual:', process.cwd());

    let skip = 0;
    let allProperties = [];
    let moreProperties = true;

    try {
        while (moreProperties) {
            const url = `https://api.wasi.co/v1/property/search?id_company=${ID_COMPANY}&wasi_token=${WASI_TOKEN}&take=${TAKE}&skip=${skip}`;
            console.log(`Solicitando datos desde: ${url}`);

            const response = await axios({
                method: 'get',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            console.log('Respuesta completa de la API:', JSON.stringify(response.data, null, 2));

            if (!response.data || response.data.status !== 'success') {
                console.error('Error en la API de WASI:', response.data);
                break;
            }

            // Convertir las propiedades del objeto raíz a un array
            const properties = Object.values(response.data).filter(
                item => typeof item === 'object' && item.id_property
            );

            if (properties.length > 0) {
                console.log(`Datos recibidos: ${properties.length} propiedades (skip: ${skip})`);
                allProperties = allProperties.concat(properties);
                console.log(`Propiedades acumuladas hasta ahora: ${allProperties.length}`);
                skip += TAKE;
                if (properties.length < TAKE) {
                    moreProperties = false;
                    console.log('Se recibieron menos propiedades que TAKE, finalizando paginación.');
                }
            } else {
                console.log('No se encontraron propiedades en esta página. Finalizando paginación.');
                moreProperties = false;
            }
        }

        console.log('Contenido de allProperties antes de guardar:', JSON.stringify(allProperties, null, 2));
        if (allProperties.length === 0) {
            console.warn('No se obtuvieron propiedades. Verifica los parámetros de la API.');
        } else {
            console.log(`Total de propiedades acumuladas: ${allProperties.length}`);
        }

        try {
            const filePath = './datos_wasi.json';
            console.log('Guardando datos en:', filePath);
            fs.writeFileSync(filePath, JSON.stringify(allProperties, null, 2));
            console.log('Datos guardados correctamente en datos_wasi.json');
        } catch (writeError) {
            console.error('Error al escribir el archivo:', writeError);
        }

        return allProperties;
    } catch (error) {
        console.error('Error al obtener datos de WASI:', error.message);
        if (error.response) {
            console.error('Datos de error de la respuesta:', error.response.data);
            console.error('Estado HTTP:', error.response.status);
        }
        return null;
    }
}

(async () => {
    const allProperties = await obtenerTodosLosDatosWasi();
    if (allProperties && allProperties.length > 0) {
        console.log('Datos obtenidos y guardados correctamente.');
    } else {
        console.log('No se obtuvieron datos para guardar.');
    }
})();