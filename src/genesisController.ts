import { getQuickJS, shouldInterruptAfterDeadline } from 'quickjs-emscripten';
import type { GenesisContext, GenesisTransition } from './genesisCore.js';

/** Pure code in a separate WASM heap. No filesystem, network, Node globals or host callbacks. */
export async function runGenesisController(source: string, context?: GenesisContext): Promise<GenesisTransition> {
  if (typeof source !== 'string' || source.length > 64 * 1024) throw new Error('Keep controller JavaScript below 64 KB.');
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(8 * 1024 * 1024); runtime.setMaxStackSize(256 * 1024);
  const vm = runtime.newContext();
  const code = `"use strict"; ${source}\n;if(typeof onEvent !== 'function') throw new Error('Define function onEvent(context).');\n${context ? `JSON.stringify((()=>{const result=onEvent(JSON.parse(${JSON.stringify(JSON.stringify(context))}));if(result && typeof result.then === 'function')throw new Error('Controllers are synchronous. Request asynchronous effects through the host.');return result;})())` : 'JSON.stringify({})'}`;
  try {
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 250));
    const evaluated = vm.evalCode(code);
    if (evaluated.error) { const error = vm.dump(evaluated.error); evaluated.error.dispose(); throw new Error(error.message || String(error)); }
    const result = vm.dump(evaluated.value); evaluated.value.dispose();
    if (typeof result !== 'string') throw new Error('Return a synchronous transition object.');
    const transition = JSON.parse(result);
    if (!transition || typeof transition !== 'object' || Array.isArray(transition) || JSON.stringify(transition).length > 64000) throw new Error('Return a transition below 64 KB.');
    return transition;
  } catch (error: any) { throw new Error(`Genesis controller: ${String(error?.message || error).slice(0, 300)}`); }
  finally { vm.dispose(); runtime.dispose(); }
}
