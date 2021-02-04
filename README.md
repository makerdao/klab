KLab
====

**NOTE:** This software is still in the early stages of development. If you are confused, find some bugs, or just want some help, please file an issue or come talk to us at <https://dapphub.chat/channel/k-framework>.
This is a **fork** of the Klab project at <https://github.com/dapphub/klab>, with many features removed and some features added.
Make sure you're aware when asking for support whether it's for the original KLab features or the additional ones here.

Klab is a tool for generating and debugging proofs in the [K Framework](http://www.kframework.org/index.php/Main_Page), tailored for the formal verification of ethereum smart contracts. It includes a succinct [specification language](acts.md) for expressing the behavior of ethereum contracts, and an interactive debugger.

Differences from Upstream
-------------------------

The upstream repository is here <https://github.com/dapphub/klab>.
There are several differences:

-   This repository no longer pins the specific version of KEVM as a submodule.
    It assumes that instead your proof repository pins the KEVM version itself.

-   All of the CI related functionality is pulled out, this version of KLab is only focused on:
    -   Converting ACT specifications into K specifications.
    -   Extracting gas expressions from KEVM proof executions.
    -   Generating a Makefile which expresses the proof dependency graph.
    -   Displaying run proofs using the KLab debugger.

-   KLab no longer explicitly handles running all the proofs itself.
    Instead, you use `klab make` to generate a Makefile which expresses the proof dependency graph.
    Then you can include the generated Makefile into your own build system which handles providing top-level targets for running all the proofs.

-   KLab no longer builds all the specifications it can at once with `klab build`.
    Instead you use `klab build-spec SPEC_NAME` to build a specific specification, which makes it a bit more modular.

-   KLab no longer handles the simplification of gas expressions, and expects you to provide a script that will do so.
    `klab get-gas` will now extract an expression that looks like `(#gas(G1) #And C1) #Or (#gas(G2) #And C2) ...` for each branch in the rough-proof execution.
    It's up to the dependent repository to provide a script which simplifies this expression for inclusion in the pass proofs.

-   KLab no longer ships with a default body of lemmas, smt prelude, or concrete rules list, it's up to the user to supply all needed lemmas.
    When you call `klab prove ...`, you can pass any additional arguments you would like to go to the K prover, allowing you to bring back these options if you need them.
    `klab prove` also no longer handles timing out for you, if you want to timeout proofs you must provide that functionality externally.

-   The generation of specifications has changed in several ways:
    -   It now takes advantage of KEVM's (Infinite Gas Abstraction)[https://github.com/kframework/evm-semantics/blob/master/tests/specs/infinite-gas.k] rather than selecting a "high-enough" gas value.
    -   The generated specifications have been tweaked to be valid for both the Java and Haskell backends of K.
    -   The generated specifications now use the "abstract-pre concrete-post" abstraction for specifying storage:
        -   The pre-state is specified fully abstractly as a variable `ACCT_STORAGE`, with side-conditions that specify certain values like `requires #lookup(ACCT_STORAGE, KEY1) ==Int VALUE1`.
        -   The post-state is specified as the sequence of writes directly on the pre-storage, like `ACCT_STORAGE [ KEY1 <- VALUE1 ]`.

Usage
-----

### Building KLab

To build KLab, simply call `npm install` in this repository.
Make sure that the path `bin/` inside this repository is on your `PATH` to be able to execute the `klab ...` commands.
Set the `KLAB_OUT` directory to where you would like all proof artifacts to be stored (this directory will typically become very large, on the order of 10s of GB).

### Setting up KEVM

KLab no longer handles setting up KEVM for you.
Follow the [Instructions for KEVM](https://github.com/kframework/evm-semantics) to setup KEVM, in particular you need to build the Java backend (`make build-java`).
Make sure that you setup the environment variable `KLAB_EVMS_PATH` to point to the absolute path of the KEVM repository root.

Usage
-----

To see how klab is used, we can explore the project in `examples/SafeAdd`:

```sh
cd examples/SafeAdd/
```

### Specification

The file `config.json` tells klab where to look for both the specification and the implementation of our contract. In this case, our specification lives in `src/`, and our implementation lives in `dapp/`.

Note that this example includes `dapp/out/SafeAdd.sol.json` compiled from the solidity source. With [solc](https://solidity.readthedocs.io/en/latest/installing-solidity.html) installed, you can compile it yourself:

```sh
solc --combined-json=abi,bin,bin-runtime,srcmap,srcmap-runtime,ast dapp/src/SafeAdd.sol > dapp/out/SafeAdd.sol.json
```

### Proof

Our goal is to prove that our implementation satisfies our specification. To do so, we'll start by building a set of K modules from our spec:

```sh
klab build
```

This will generate success and failure reachability rules for each `act` of our specification. We can find the results in the `out/specs` directory.

Now we're ready to prove each case, for example:

```sh
klab prove --dump SafeAdd_add_fail
```

The `--dump` flag outputs a log to `out/data/<hash>.log`, which will be needed later for interactive debugging. We can also do `klab prove-all` to prove all outstanding claims.

Once the proof is complete, we can explore the generated symbolic execution trace using:

```sh
klab debug <hash>
```

### Key Bindings

Toggle different views by pressing any of the following keys:

**View Commands**:

-   `t` - display the (somewhat) pretty K **t**erm.
-   `c` - display current **c**onstraints.
-   `k` - display `<k>` cell.
-   `b` - display **b**ehavior tree.
-   `s` - diaplay **s**ource code.
-   `e` - display **e**vm specific module.
-   `m` - display **m**emory cell.
-   `d` - display **d**ebug cells (see toggling debug cells below).
-   `r` - display applied K **r**ule.
-   `z` - display **z**3 feedback from attempted rule application.
-   `Up/Dn` - scroll view **up** and **down**.

**Navigation Commands**:

-   `n`       - step to **n**ext opcode
-   `p`       - step to **p**revious opcode
-   `Shift+n` - step to **n**ext k term
-   `Shift+p` - step to **p**revious k term
-   `Ctrl+n`  - step to **n**ext branch point
-   `Ctrl+p`  - step to **p**revious branch point

**Toggling Debug Cells**:

The following commands are prefixed with `:` (and are typed at the bottom of the interface).
It's possible to toggle the debug cells view for specific cells, which prints out the JSON representation of the given cells.
Remember, you must turn on the **d**ebug cells view to see these (above).

-   `:show ethereum.evm.callState.gas` - show the contents of the `<gas>` cell in the **d**ebug cells view.
-   `:hide ethereum.evm.callStack.pc`  - hide the contents of the `<pc>` cell in the **d**ebug cells view.
-   `:omit   gas pc` - omit the contents of the `<gas>` and `<pc>` cells in the **t**erm view.
-   `:unomit pc programBytes`  - unomit the contents of the `<pc>` and `<programBytes>` cells in the **t**erm view.

### Available klab Commands

-   `klab build` - builds a set of K reachability claims in `out/specs` based on the spec, lemmas and source code as specified in the projects `config.json`.
-   `klab prove <hash> [--dump]` - executes a K reachability claim specified as a hash to the K prover. If the `--dump` flag is present, the proof can be explored using `klab debug`.
-   `klab debug <hash>` - opens up the cli proof explorer of a particular proof execution. See key bindings above.
-   `klab hash` - prints the hash of the focused proof
-   `klab get-gas <hash>` - Traverses the execution trace of a proof object to fetch its gas usage, put in `out/gas/<hash>gas.k`.
-   `klab make` - generate a Makefile-style dependency graph between all the proofs in your ACT specification.

### Configuration

The `config.json` file is used to configure klab.

Here's an example:

```json
{
  "name": "k-dss",
  "url": "https://github.com/dapphub/k-dss",
  "src": {
    "specification": "./src/dss.md",
    "smt_prelude": "./src/prelude.smt2.md",
    "rules": [
      "./src/storage.k.md",
      "./src/lemmas.k.md"
    ],
    "dirty_rules": [
      "./src/dirty_lemmas.k.md"
    ]
  },
  "implementations": {
    "Vat": {
      "src": "src/vat.sol"
    },
    "Vow": {
      "src": "src/vow.sol"
    },
  },
  "timeouts": {
    "Vat_grab_pass_rough": "16h",
  },
  "memory" : {
    "Vat_frob-diff-nonzero_fail_rough": "25G",
  },
  "dapp_root": "./dss",
  "solc_output_path": "out/dapp.sol.json",
  "host": "127.0.0.1:8080"
}
```

Troubleshooting
---------------

### Outdated npm

You might have problems due to an outdated `npm`, in that case try updating it with:

```sh
npm install npm@latest -g
npm install -g n
n stable
```

### KLab server requesting files at incorrect directory

What it looks like:

```
$ klab server

18.07.30 14-46-50: exec dfc688db4cc98b5de315bdfaa2512b84d14c3aaf3e58581ae728247097ff300d/run.sh
18.07.30 14-47-32: out Debugg: dfc688db4cc98b5de315bdfaa2512b84d14c3aaf3e58581ae728247097ff300d

fs.js:119
throw err;
^

Error: ENOENT: no such file or directory, open '/tmp/klab/b042c99687ae5018744dc96107032b291e4a91f1ab38a6286b2aff9a78056665/abstract-semantics.k'
at Object.openSync (fs.js:443:3)
at Object.readFileSync (fs.js:348:35)
at getFileExcerpt (/home/dev/src/klab/lib/rule.js:5:4)
at Object.parseRule (/home/dev/src/klab/lib/rule.js:21:16)
at Object.getblob (/home/dev/src/klab/lib/driver/dbDriver.js:49:19)
at Object.next (/home/dev/src/klab/lib/driver/dbDriver.js:113:56)
at Stream._n (/home/dev/src/klab/node_modules/xstream/index.js:797:18)
at /home/dev/src/klab/node_modules/@cycle/run/lib/cjs/index.js:57:61
at process._tickCallback (internal/process/next_tick.js:61:11)
[1] [dev@arch-ehildenb klab]% klab server
fs.js:119
throw err;
```

Notice how it's requesting `abstract-semantics.k` from proof-hash `b042...` but we're actually running proof-hash `dfc6...`.
This is a problem with how K caches compiled definitions, and must be [fixed upstream](https://github.com/kframework/k/issues/107).

To fix this, run:

```sh
make clean && make deps
```

This will remove and recompile the KEVM semantics.

License
-------

All contributions to this repository are licensed under AGPL-3.0. Authors:

* Denis Erfurt
* Martin Lundfall
* Everett Hildenbrandt
* Lev Livnev
