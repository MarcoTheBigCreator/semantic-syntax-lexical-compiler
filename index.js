import fs from "fs";
import readline from "readline";
import { States, Finals, Reserved } from "./table.js";
import { syntacticAnalizer } from "./syntax.js";

const inputFile = "file2.txt";
const outputFile = "output.txt";
const symFile = "symtable.txt";
const errorFile = "error.txt";

const readStream = fs.createReadStream(inputFile, "utf8");

const writeStream = fs.createWriteStream(outputFile, "utf8");

const errorStream = fs.createWriteStream(errorFile, "utf8");

const symStream = fs.createWriteStream(symFile, "utf8");

const readLine = readline.createInterface({
  input: readStream,
  crlfDelay: Infinity,
});

let lineCount = 0;
let current = "";
let state = 0;
let carry = false;
const result = [];

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
  }
  console.log("---> Correct Lexical");
  try {
    console.log("--TOKENS-- \n tokens->", res);
    const r = syntacticAnalizer(res, result);
    console.log("Symbols->", r);
    symStream.write(
      Object.keys(r)
        .map((id) =>
          JSON.stringify({
            [id]: { type: `${r[id].type}`, value: `${r[id].value}` },
          })
        )
        .join("\n") + "\n"
    );
  } catch (error) {
    console.log(error);
    errorStream.write(`${error}`);
  }
  writeStream.end();
  symStream.end();
  errorStream.end();
});
