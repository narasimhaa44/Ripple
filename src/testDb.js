
import { graph } from "./db.js";

try {
    const result = await graph.query(
        "MATCH (n) RETURN count(n) AS totalNodes"
    );

    console.log("FalkorDB connection successful!");
    console.dir(result, { depth: null });
} catch (error) {
    console.error("Database test failed:", error.message);
    process.exitCode = 1;
}
