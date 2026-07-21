// @pdf-lib/fontkit 无自带类型声明；pdf-lib 的 registerFontkit 只需一个不透明的 Fontkit 对象。
declare module '@pdf-lib/fontkit' {
  // pdf-lib 的 registerFontkit 需要一个 Fontkit 对象；此处用宽松类型避免引入 fontkit 内部类型
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fontkit: any
  export default fontkit
}
