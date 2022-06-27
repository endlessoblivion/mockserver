module.exports = function headerHandler(value, request) {
  if (!/^#header/m.test(value)) return value;
  return value
    .replace(/^#header \$\{([^}]*)\};?/m, function (statement, val) {
    return eval(val);
  })
    .replace(/\r\n?/g, '\n');
}
