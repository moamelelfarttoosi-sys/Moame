'use strict';
const { migrate } = require('./db');
migrate();
console.log('Migration complete.');
