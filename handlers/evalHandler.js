module.exports = function evalHandler(value, request) {
  if (!/^#eval/m.test(value)) return value;
  return value
    .replaceAll(/^#eval (.*);/mg, function (statement, val) {
    return eval(val);
  })
    .replace(/\r\n?/g, '\n');
}
