import sys
import asyncio
import uvicorn


def main() -> None:
    # Uvicorn 0.36+ builds the loop from a factory and ignores the Windows
    # selector policy. ProactorEventLoop breaks SSL to TiDB (WinError 87).
    if sys.platform.startswith("win"):
        import uvicorn.loops.asyncio as asyncio_loops

        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

        def _selector_loop_factory(use_subprocess: bool = False):
            return asyncio.SelectorEventLoop

        asyncio_loops.asyncio_loop_factory = _selector_loop_factory

    # Bind all interfaces so both 127.0.0.1 and localhost work from the browser
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, loop="asyncio")


if __name__ == "__main__":
    main()
