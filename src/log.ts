import pino from 'pino';
import pretty from 'pino-pretty';
const log = pino(pretty())

export default log;
