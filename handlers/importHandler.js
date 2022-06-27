const fs = require('fs');
const path = require('path');

module.exports = function importHandler(value, context, request, { isHeaders } = {}) {
    if (!/#import/m.test(value)) return value;

    return value
      .replace(/#import([^;]*);/mg, function (includeStatement, file) {
          const importThisFile = file.trim().replace(/['"]/g, '');
          const content = fs.readFileSync(path.join(context, importThisFile));
          if (importThisFile.endsWith('.js')) {
              return (isHeaders ? _ => _ : JSON.stringify)(eval(content.toString()));
          } else {
              return content;
          }
      })
      .replace(/\r\n?/g, '\n');
}
