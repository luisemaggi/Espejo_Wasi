const axios = require('axios');
const fs = require('fs');

const ID_COMPANY = '21730098';
const WASI_TOKEN = 'Y3vR_nV5K_WHkR_JH8t';
const TAKE = 50;

async function obtenerTodosLosDatosWasi() {
    let skip = 0;
    let allProperties = [];

    try {
        while (true) {
            const url = `https://api.wasi.co/v1/property/search?id_company=${ID_COMPANY}&wasi_token=${WASI_TOKEN}&take=${TAKE}&skip=${skip}`;

            const response = await axios({
                method: 'get',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Node.js'
                }
            });

            console.log(JSON.stringify(response.data, null, 2)); // Verificación detallada de la respuesta

            if (response.data && response.data.status !== 'success') {
                console.error('Error en la API de WASI:', response.data);
                break;
            }

            if (response.data && response.data.properties) {
                console.log('Tipo de response.data.properties:', typeof response.data.properties);
            }

            if (response.data && response.data.properties && response.data.properties.length > 0) {
                allProperties = allProperties.concat(response.data.properties);
                skip += TAKE;
            } else {
                break;
            }
        }

        // Forzar la escritura del archivo después de recibir todos los datos
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            fs.writeFileSync('datos_wasi.json', JSON.stringify(allProperties, null, 2));
            console.log('Datos guardados en datos_wasi.json');
        } catch (writeError) {
            console.error('Error al escribir el archivo:', writeError);
        }

        return allProperties;
    } catch (error) {
        console.error('Error al obtener datos de WASI:', error);
        if (error.response) {
            console.error('Datos de error de la respuesta:', error.response.data);
            console.error('Encabezados de error de la respuesta:', error.response.headers);
        }
        console.error('Configuración de error:', error.config);
        return null;
    }
}

obtenerTodosLosDatosWasi();
