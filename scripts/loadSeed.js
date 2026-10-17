
import { readFile } from "node:fs/promises";
import { FalkorDB } from "falkordb";

const GRAPH_NAME = "ripple";

async function main() {
    let db;

    try {
        db = await FalkorDB.connect({
            host: "localhost",
            port: 6379,
        });

        const graph = db.selectGraph(GRAPH_NAME);
        const fileUrl = new URL("../graphs/seed.cypher", import.meta.url);
        const seed = await readFile(fileUrl, "utf8");

        // Split the file into individual Cypher statements.
        const statements = seed
            .split(";")
            .map((statement) => statement.trim())
            .filter((statement) => statement.length > 0);

        for (let i = 0; i < statements.length; i++) {
            await graph.query(statements[i]);
            console.log(`Executed statement ${i + 1}/${statements.length}`);
        }

        console.log("\nRipple seed data loaded successfully!");
    } catch (error) {
        console.error("Seed loading failed:", error.message);
        process.exitCode = 1;
    } finally {
        if (db) {
            await db.close();
        }
    }
}

main();
