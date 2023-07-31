// import the following modules
import fs from "fs";
import readline from "readline";
import { States, Finals, Reserved } from "./transitionTable.js";
import { syntacticAnalizer } from "./syntaxAnalyzer.js";

// define the input and output files
const inputFile = "code.txt";
const outputFile = "output.txt";
const symFile = "systemTable.txt";
const errorFile = "error.txt";

// create the read and write streams
const readStream = fs.createReadStream(inputFile, "utf8");

const writeStream = fs.createWriteStream(outputFile, "utf8");

// create the error stream
const errorStream = fs.createWriteStream(errorFile, "utf8");

const symStream = fs.createWriteStream(symFile, "utf8");

// create the readline interface
const readLine = readline.createInterface({
  input: readStream,
  crlfDelay: Infinity,
});

// define the variables
let lineCount = 0;
let current = "";
let state = 0;
let carry = false;
const result = [];

// define the analyzeChar function
const analyzeChar = (char, position) => {
  const currState = States[state];
  let matched = false;
  if (currState.moves) {
    for (const key in currState.moves) {
      const compare = RegExp(key);
      const match = char.match(compare);
      if (match) {
        if (currState.will === "carry") {
          carry = true;
        }
        state = currState.moves[key];
        matched = true;
        current.length === 0 ? (current = char) : (current = current + char);
        current = current.trimStart();
        break;
      }
    }
  } else if (currState.will === "end") {
    result.push({ type: Finals[state], value: current.trim() });
    carry = false;
    matched = true;
    state = 0;
    current = "";
    return true;
  } else if (currState.will === "reserved") {
    if (Object.keys(Reserved).includes(current[0])) {
      for (let index = 0; index < Reserved[current[0]].length; index++) {
        const word = Reserved[current[0]][index];
        if (word.includes(current)) {
          if (word.length === current.length) {
            result.push({ type: "RESERVED", value: current.trim() });
            carry = false;
            matched = true;
            state = 0;
            current = "";
            return true;
          } else {
            current = current + char;
            matched = true;
            break;
          }
        }
      }
    }
  }
  if (!matched) {
    if (currState.will === "end") {
      if (currState.predates) {
        if (Finals[currState.predates] === result[result.length - 1].type) {
          result.pop();
        }
      }
      result.push({ type: Finals[state], value: current.trim() });
      carry = false;
      matched = true;
      state = 0;
      current = "";
      return true;
    } else {
      if (char) {
        throw new Error(
          `--> st:${state} Invalid character: -${char}-, at position ${position}`
        );
      }
    }
  }
};

// define the readLine events
readLine.on("line", (line) => {
  try {
    const chars = line.split("");
    for (let index = 0; index <= chars.length; index++) {
      let char;
      if (index < chars.length) {
        char = chars[index];
      } else {
        char = "";
      }
      const pos = index + 1;
      const n = analyzeChar(char, pos);
      if (n) {
        index--;
      }
    }
    lineCount++;
    writeStream.write(
      result.map((token) => JSON.stringify(token)).join("\n") + "\n"
    );
  } catch (error) {
    lineCount++;
    if (result) {
      writeStream.write(
        result.map((token) => JSON.stringify(token)).join("\n") + "\n"
      );
    }
    errorStream.write("Error on line " + lineCount + " -> " + error + "\n");
    console.error("Error on line " + lineCount + " -> " + error + "\n");
  }
});

// define the readLine close event
readLine.on("close", () => {
  if (carry) {
    console.error(
      "Error on line " + lineCount + " -> " + current + " was not closed \n"
    );
    errorStream.write(
      "Error on line " + lineCount + " -> " + current + " was not closed \n"
    );
  }
  let res = "";
  let tokensCon = "";
  for (let index = 0; index < result.length; index++) {
    const token = result[index];
    if (
      token.type === "INT" ||
      token.type === "FLOAT" ||
      token.type === "IDENTIFIER" ||
      token.type === "STRING"
    ) {
      res = res.concat(`${token.type}`);
    } else if (token.type !== "COMMENT") {
      res = res.concat(`${token.value}`);
    }
    if (
      token.type === "INT" ||
      token.type === "FLOAT" ||
      token.type === "IDENTIFIER" ||
      token.type === "STRING" ||
      token.type === "COMMENT" ||
      token.type === "RESERVED"
    ) {
      tokensCon = tokensCon.concat(`${token.type} ,`);
    }
  }
  if (tokensCon.endsWith(",")) {
    tokensCon = tokensCon.slice(0, -1);
  }
  try {
    console.log(`
╔════════════════════════════════════════════════╗
  🌟🌟🌟  TOKENS  🌟🌟🌟
`);
    console.log(`( ${tokensCon})\n`);

    console.log("===> 🚀🚀 Correct Lexical 🚀🚀 <===");
    const r = syntacticAnalizer(res, result);
    console.log(`\n🔷🔷🔷  SEMANTIC TABLE 🔷🔷🔷`);
    const data = Object.keys(r).map((id) => ({
      ID: id,
      Type: r[id].type,
      Value: r[id].value,
    }));
    console.table(data);
    console.log("\n===> ✅✅ FINISHED SUCCESSFULLY ✅✅ <===");
    console.log(`
╚════════════════════════════════════════════════╝`);
  } catch (error) {
    console.log(error);
    errorStream.write(`${error}`);
  }
  // close the streams
  writeStream.end();
  symStream.end();
  errorStream.end();
});
