// Must be the first import of every CLI entry point and worker: it forces the
// Albert environment before any flag is read and wraps every network client
// before any module can capture an unwrapped reference.
import { enforce } from "@albert-code/guard/env"
import { install } from "@albert-code/guard/install"
import { write } from "./catalog"

enforce(process.env)
install()
process.env.KILO_MODELS_PATH = write()
