function calculateFontSize(txt, wPx, hPx, initialFontSize) {
  const charLen = txt.trim().length;
  const isRegional = /[^\x00-\x7F]/.test(txt);
  let fontSize = Math.round(initialFontSize);

  if (charLen > 0 && wPx > 0 && hPx > 0) {
    const fontScaleFactor = isRegional ? 0.75 : 0.43;
    
    let testFontSize = fontSize;
    while (testFontSize > 18) {
      const charPerLine = Math.max(5, Math.floor(wPx / (testFontSize * fontScaleFactor)));
      const linesCount = Math.ceil(charLen / charPerLine);
      const totalHeight = linesCount * testFontSize * 1.25;
      if (totalHeight <= hPx) {
        break;
      }
      testFontSize--;
    }
    fontSize = testFontSize;
  }
  return { fontSize, isRegional };
}

console.log("Very long English address (120 chars):", calculateFontSize("No 56, Bujjiana street, Walajapet , Ranipet Dt - 632 513, Opposite to Gold Shop, Landmark Area, Tamil Nadu, India", 1080, 172, 56));
console.log("Very long Tamil text (100 chars):", calculateFontSize("அனைவருக்கும் இனிய ஆடிப்பெருக்கு நல்வாழ்த்துகள். இன்று தங்கம் மற்றும் வெள்ளி விலை நிலவரம்.", 1080, 172, 56));
