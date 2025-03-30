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
          'User-Agent': 'Node.js' // Agregado el User-Agent
        }
      });

      // Verificar los encabezados de la solicitud
      console.log('Headers de la solicitud:', response.config.headers);

      // Verificar URL de la solicitud
      console.log('URL de la solicitud:', response.config.url);

      // Verificar el código de estado de la respuesta
      console.log('Código de estado de la respuesta:', response.status);

      // Verificar los encabezados de la respuesta
      console.log('Headers de la respuesta:', response.headers);

      // Verificar los datos de la respuesta
      console.log('Datos de la respuesta:', response.data);

      if (response.data && response.data.length > 0) {
        allProperties = allProperties.concat(response.data);
        skip += TAKE;
      } else {
        break;
      }
    }

    // Guardar los datos en un archivo JSON
    fs.writeFileSync('datos_wasi.json', JSON.stringify(allProperties, null, 2));
    console.log('Datos guardados en datos_wasi.json');
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
