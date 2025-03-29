const axios = require('axios');

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

      if (response.data && response.data.length > 0) {
        allProperties = allProperties.concat(response.data);
        skip += TAKE;
      } else {
        break;
      }
    }

    console.log(JSON.stringify(allProperties, null, 2));
    return allProperties;
  } catch (error) {
    console.error('Error al obtener datos de WASI:', error);
    console.error(error.response);
    console.error(error.config);
    return null;
  }
}

obtenerTodosLosDatosWasi();
