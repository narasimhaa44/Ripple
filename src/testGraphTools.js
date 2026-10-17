
import "dotenv/config";
import { listServices } from "./services/graphTools.js";
import { closeDatabase } from "./db.js";

try {
    const services = await listServices();

    console.log("Services discovered:", services.length);
    console.table(services);
} catch (error) {
    console.error("Graph tool test failed:", error.message);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
