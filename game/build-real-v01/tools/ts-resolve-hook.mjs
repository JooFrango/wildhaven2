// Hook de resolução para importar o TypeScript da Alpha (somente leitura) com
// `--experimental-strip-types`: completa especificadores relativos sem extensão com ".ts".
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[cm]?[jt]s$/.test(specifier)) {
    try { return await next(specifier + ".ts", context); } catch { /* cai no padrão */ }
  }
  return next(specifier, context);
}
