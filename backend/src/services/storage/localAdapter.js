'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function createLocalAdapter({ baseDir }) {
  const resolvedBaseDir = path.resolve(baseDir);

  function resolveKeyPath(key) {
    const resolved = path.resolve(resolvedBaseDir, key);
    if (resolved !== resolvedBaseDir && !resolved.startsWith(resolvedBaseDir + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  }

  return {
    driver: 'local',

    async init() {
      await fsp.mkdir(resolvedBaseDir, { recursive: true });
    },

    async put(key, buffer) {
      const filePath = resolveKeyPath(key);
      await fsp.writeFile(filePath, buffer);
    },

    async get(key) {
      const filePath = resolveKeyPath(key);
      let stat;
      try {
        stat = await fsp.stat(filePath);
      } catch (err) {
        if (err.code === 'ENOENT') {
          const notFound = new Error('Object not found');
          notFound.code = 'NOT_FOUND';
          throw notFound;
        }
        throw err;
      }
      return {
        stream: fs.createReadStream(filePath),
        contentLength: stat.size,
      };
    },

    async delete(key) {
      const filePath = resolveKeyPath(key);
      try {
        await fsp.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    },
  };
}

module.exports = { createLocalAdapter };
