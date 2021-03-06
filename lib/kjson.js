const _     = require("lodash");
const kjson = require("./k.json");


const renderRule  = o => {
    let json = Object.keys(o.term)
      .reduce((obj, path) => _.set(obj.t, path, o.term[path]) && obj, {...kjson})
    json.requires = json.requires.concat(o.requires || [])
    json.ensures = o.ensures

  let renderCell = (obj, key) => {
    let cell = `<${key}>${typeof obj[key] == "object" ? "\n" : ""}${compile(obj[key])}${typeof obj[key] == "object" ? "\n" : ""}</${key}>`
    return cell;
  }
  let compile = obj => typeof obj == "object"
    && (Array.isArray(obj)
      && obj.map(compile).join("\n")
      || Object
        .keys(obj)
        .map(key => renderCell(obj, key))
        .join("\n")
        .split("\n")
        .map(s => "  " + s)
        .join("\n")
      )
    || " " + obj + " "
  let generatedTop = compile(json.t);
  let requires     = json.requires.join("\n");
  let ensures      = json.ensures ? '\nensures\n' + json.ensures.join('\n    andBool ') : ''
  let name         = o.name;
  return `// ${name}\nclaim [${o.fullname.replace(/_/g, ".")}]:\n${generatedTop}\nrequires ${requires} ${ensures}`
}

const renderModule = (rules, name) => `requires "verification.k"

module ${name.toUpperCase()}
  imports KLAB-VERIFICATION

${rules.join("\n\n")}

endmodule
`

// o.name
// o.term
// o.requires

module.exports = {
   renderRule,
   renderModule
}
