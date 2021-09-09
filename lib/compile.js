// const fs = require("fs");
const path = require("path");
const {
  testPath,
  read
} = require("../lib/util.js");
const pure = require("../lib/pure.js");
const {getInfo} = require("../lib/clean-evm-node.js");
const kast = require("./kast.js");

const KLAB_OUT = process.env.KLAB_OUT || "out";
const KLAB_WD_PATH = path.join(KLAB_OUT, "data");

const prune_edges = (proofid, { prune, verbose } = {}) => {
  // console.log(`pruning ${proofid}`);

  if(verbose) console.log("read the log...");
  const logs = read(path.join(KLAB_WD_PATH, proofid + ".k.log"))
    .split("\n")
    .filter(l => !!l)
  // .map(l => l.split(" "))

  if(verbose) console.log("build init, target and finished");
  const initt = logs
    .find(l => l.split(" ")[1] == "REACHINIT" || l.split(" ")[1] == "EXECINIT")
    .split(" ")[2]
  const targetlog = logs
    .find(l => l.split(" ")[1] == "REACHTARGET");

  const targett = targetlog && targetlog.split(" ")[2]

  const finished = logs
    .filter(l => l.split(" ")[1] == "REACHPROVED")
    .map(l => l.split(" ")[2])

  if(verbose) console.log("filter for edges...");
  const edges_logs = logs
    .filter(l => ["RULE", "SRULE"].indexOf(l.split(" ")[1]) > -1)

  if(verbose) console.log("construct edges...");
  const edges = edges_logs
    .map(l => pure({data: l}))
    .reduce((a, e) => {
      a[e.from] = (a[e.from] || []).concat({
        from: e.from,
        to: e.to,
        rule: e.rule
      })
      return a;
    }, {})

  if(verbose) console.log("construct rule_debug...");
  const rule_debug = logs
    .filter(l => ["RULEATTEMPT", "SRULEATTEMPT", "CHECKINGCONSTRAINT", "Z3QUERY", "Z3RESULT", "IMPLICATION"])
    .map(l => pure({data: l}))
    .reduce(({nodes, n, r, c, z}, x) => {
      if((n == null || r == null) && x.type != 'RULEATTEMPT' && x.type != 'SRULEATTEMPT') return { n, r, c, nodes }
        switch (x.type) {
          case "SRULEATTEMPT":
          case "RULEATTEMPT":
            n = x.nodeid;
            r = x.rule;
            c = null;
            z = null;
            if(!nodes[n]) nodes[n] = {};
            if(!nodes[n][r]) nodes[n][r] = {};
            break;
          case "CHECKINGCONSTRAINT":
            c = x.constraint;
            z = null;
            nodes[n][r][c] = {};
            break;
          case "IMPLICATION":
            c = x.rhs;
            z = null;
            nodes[n][r][c] = {};
            break;
          case "Z3QUERY":
            if(c == null) break;
            z = x.query;
            break;
          case "Z3RESULT":
            if(c == null) break;
            nodes[n][r][c][z] = x.result;
            break;
        }
      return { n, r, c, z, nodes }
    }, {
      nodes: {},
      n: null,
      r: null,
      c: null,
      z: null
    }).nodes

  if(verbose) console.log("construct rules...");
  const rules = logs
    .filter(l => l.split(" ")[1] == "RULE")
    .map(l => l.split(" ")[2].split("_")[0])
    .reduce((a, ruleid) => {
      if(a && !a[ruleid]) {
        try { a[ruleid] = JSON.parse(read(path.join(KLAB_WD_PATH, `${proofid}.k_blobs`, ruleid + ".json"))) }
        catch(e) {console.log('bad json: ' + path.join(KLAB_WD_PATH, `${proofid}.k_blobs`, ruleid + ".json"))}
      }
      return a;
    }, {})

  if(verbose) console.log("construct steps...");
  const steps = Object.keys(rules)
    .filter(ruleid => {
      let label = (rules[ruleid].term.att
        .match(/label\(([^\)]*)\)/g) || [])
        .map(s => s.slice(6, -1).split('.')[1])
      return ['step', 'halt'].indexOf(label.length > 0 && label[0]) > -1
    })

  // propagate steps, prune non-steps
  const isStep     = edge => steps.indexOf(edge.rule) > -1
  const isRelevant = edge => isStep(edge) || edge.to == targett;

  const state = {
    edges: [],
    frontier: [
      {
        from: initt,
        to: initt
      }
    ]
  }

  while(prune && state.frontier.length > 0) {
    // console.log("frontier", state.frontier);
    let frontier_ = state.frontier
      .filter(edge => edges[edge.to])
      .map(edge => edges[edge.to].map(e => ({
        ...edge,
        to: e.to,
        rule: e.rule
      })))
      .reduce((a, e) => a.concat(e), [])
    // console.log("frontier_", frontier_);
    let steps_ = frontier_
      .filter(edge => isRelevant(edge))
    // console.log("steps", steps_);
    let nonsteps_ = frontier_
      .filter(edge => !isRelevant(edge))
    // console.log("nonsteps", nonsteps_);
    state.edges = state.edges.concat(steps_);
    state.frontier = steps_
      .map(edge => ({
        from: edge.to,
        to: edge.to
      }))
      .concat(nonsteps_)
  }

  if(verbose) console.log("pruning edges...");
  var pruned_edges = state.edges
    .reduce((a, e) => {
      a[e.from] = (a[e.from] || []).concat({
        from: e.from,
        to: e.to
      })
      return a;
    }, {})

  if(!prune) {
    pruned_edges = edges;
  }

  const old_edges_length = edges_logs.length;
  const pruned_edges_length = state.edges.length;
  const reduction_ratio = Math.floor((pruned_edges_length / old_edges_length) * 100)
  // console.log(`Reduced edges to ${reduction_ratio}%`);

  if(verbose) console.log("done pruning!");
  return {
    finished,
    pruned_edges,
    initt,
    targett,
    steps,
    rule_debug
  }
}



module.exports = {
  prune_edges
};
