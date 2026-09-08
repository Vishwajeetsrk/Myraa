const fs = require('fs');

const js = fs.readFileSync('C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const returnIdx = 512997;
const jsx = js.slice(returnIdx, returnIdx + 15000);

let re = /b\.jsx[s]?\("button",\{/g;
let m;
while ((m = re.exec(jsx)) !== null) {
  console.log('Button at offset:', m.index);
  console.log(jsx.slice(m.index, m.index + 250));
}
