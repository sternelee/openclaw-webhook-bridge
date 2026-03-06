// Compare scopes in connect request
const rustScopes = ["operator.read", "operator.write", "operator.admin"];
const expectedScopes = ["operator.read", "operator.write", "operator.admin"];

console.log("Rust scopes:", rustScopes);
console.log("Expected scopes:", expectedScopes);
console.log("Match:", JSON.stringify(rustScopes) === JSON.stringify(expectedScopes));

// The payload uses scopes.join(",")
const scopesString = rustScopes.join(",");
console.log("\nScopes in payload:", scopesString);
console.log("Expected:", "operator.read,operator.write,operator.admin");
console.log("Match:", scopesString === "operator.read,operator.write,operator.admin");
