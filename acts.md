# Specification format
Klab uses a custom, concise way of specifying the behavior of an ethereum smart contract function. These are expressed in what we call `acts`.

An `act` will generate one or more K framework reachability claims which can be automatically verified.

A reachability claim is a statement of the following form:
Any execution starting from a state A, subject to the conditions B, will end in the state C satisfying the conditions D.

The syntax of such a claim in K is:
```
rule A => C
    requires B
    ensures D
```
However, when `A` and `C` both express configurations describing the entire state relevant to an ethereum contract, such an expression can get quite [large](https://github.com/dapphub/k-dss/blob/6d536c91a407fd3ead44b9347e25b6790663a10a/out/specs/proof-Vat_tune_succ.k).

Therefore, we have adapted a more concise format for specifying the behavior of a smart contract function.
## Example: Overflow safe addition
Let's begin by considering the following very simple contract, performing overflow safe addition:
```solidity
pragma solidity ^0.4.21;
contract SafeAdd {
  function add(uint x, uint y) internal pure returns (uint z) {
    z = x + y;
    require(z >= x);
  }

}
```
Our verification claim states that the function `add` above returns the sum `X + Y` if `0 <= X + Y < 2^256`, and reverts otherwise. Note that K requires all variables to begin with upper case.
```
behaviour add of SafeAdd
interface add(uint256 X, uint256 Y)

iff in range uint256

    X + Y

if

    VGas > 330

returns X + Y

```
More explicitly, the specification above generates two reachability claims, a success and a failure case. The success case assumes the conditions given in both the `iff` and `if` clause and asserts that any call to `add` with arguments `X` and `Y` returns `X + Y`, while the failure case assumes the conditions of the `if` clause and the *negation* of the `iff` clause, asserting that a call to `add` necessarily ends in a `REVERT`.

To verify these claims, we need access to the bytecode generated by the code above. You can generate the proof claims by running `klab build` in the `klab/examples/SafeAdd` directory. This fetches the bytecode from the `sol.json` file specified in `klab/examples/config.json`, and generates the K reachability rules (or proof claims) in the `klab/examples/out/specs` directory. You can run the proof by running `klab debug <path-to-reachability-rule.k>`.

## Storage

A crucial part of the specification of many contracts is storage. Recall that the storage of an ethereum smart contract consists of a map of 32 byte words to 32 byte words. In Solidity, the storage location of variables is determined by their position in the source code. For example, if we declare:
```Solidity
contract Example {
  uint a = 42;
  uint b = 99;
}
```
we find the value of `a` at storage location `0` and `b` at `1`.

When storing mappings things are slightly more complicated, and behaviours differ between Solidity and Viper. The location of an entry to a one-dimensional map declared at the `n`:th position in a Solidity contract is given by `hash(key1 ++ n)`. K uses a shorthand notation to express this: `#hashedLocation({COMPILER}, n, keys...)`. This means that if we want to express that the `balance` of `Someone` is `MillionsUponMillions`, we write:
```
storage

#hashedLocation(Solidity, 0, Someone) |-> MillionsUponMillions

```
For a more thorough explanation about storage locations, check out [edsl.md](https://github.com/kframework/evm-semantics/blob/master/edsl.md#hashed-location-for-storage).

If we want to specify that the value at a particular storage location will be updated, we specify this with a rewrite arrow, `=>`:
```
storage

#hashedLocation("Solidity", 0, Someone) |-> PreStateValue => PostStateValue

```
## Example: Token
Now we are ready to verify a (simplified) ERC20 token:
```Solidity
contract Token {
  mapping(address => uint) public balanceOf;
  uint public totalSupply;

  function add(uint256 x, uint256 y) internal returns (uint z) {
    z = x + y;
    require(z >= x);
  }

  function sub(uint256 x, uint256 y) internal returns (uint z) {
    z = x - y;
    require(x >= y);
  }

  function constructor(uint supply) {
    totalSupply = supply;
    balanceOf[msg.sender] = supply;
  }

  function transfer(address to, uint256 value) public {
    balanceOf[msg.sender] = sub(balanceOf[msg.sender], value);
    balanceOf[to] = add(balanceOf[to], value);
  }
}
```
The specification of the `transfer` function above is given by the following expression.
```
behaviour transfer of Token
interface transfer(address To, uint256 Value)

types

    FromBal : uint256
    ToBal   : uint256

storage

    #hashedLocation("Solidity", 0, CALLER_ID) |-> FromBal => FromBal - Value
    #hashedLocation("Solidity", 0, To)        |-> ToBal   => ToBal + Value

iff in range uint256

    FromBal - Value
    ToBal + Value

if
    VGas >= 100000
```
Notice that we don't need to specify the *entire* storage of our contract. The remaining storage locations are kept abstract, without any assumptions on what they may hold.

Check out the [examples](examples) directory for more.

## Supported headers
### behaviour
An `act` begins with an expression:
```
behaviour [1] of [2]
interface [3]
```
where `[1]` specifies the act name and `[2]` specifies which contract it refers to. The name of the contract must be equal to `[2]`.
### interface
The second line populates the `<callData>` K cell. `[3]` must contain the exact name of the function, and its arguments. Keywords such as `public`, `static`, `payable` do not need to be specified, but there is support for the `internal` keyword.

If the `internal` keyword is given in the `interface` header of a function, the `pc` K cell will be extracted from the Solidity AST in the `.sol.json` and the `<callData>` will be abstracted. This is useful for importing rewrite rules into other functions.

### types
If you need to refer to other variables in your spec (for example, values of particular storage locations), they will most often be interpreted as true integers by K. In most cases, we want to restrict the range of these integers to be that of an EVM `uint256` for example. You can do this by typing variables under the `types` header. For example, if you incude the section
```
types
    A   : uint256
    Lad : address
    B   : int256
```
in your act this will add the following conditions to both success and failure specs:
```
#rangeUInt(256, A)
andBool #rangeAddress(Lad)
andBool #rangeSInt(256,B)

```

### storage
To specify the storage of the contract the `act` refers to, simply use the `storage` header. You can also specify the storage of other contracts using:
```
storage [4]
    [5]
```
where `[4]` should the name of the contract, which needs to be specified in the `config.json`.

### stack
Specifies the wordstack.

### pc
Specifies the program counter.

### gas
If you want to specify the gas usage precisely, you can use the `gas` header:
```
gas
    VGas => YGas
```
### such that
May contain conditions which must hold in the poststate. Translates to `ensures` in K. Useful for specifying the total gas usage of a function, as in:

```
such that
    YGas >= VGas - 109
    YGas <= VGas - 80
```