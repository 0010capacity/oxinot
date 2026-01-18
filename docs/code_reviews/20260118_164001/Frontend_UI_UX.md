Loaded cached credentials.

<--- Last few GCs --->

[82477:0xac95ec000]   128931 ms: Mark-Compact 4086.4 (4098.8) -> 4086.1 (4098.3) MB, pooled: 1.2 MB, 425.44 / 0.00 ms (average mu = 0.477, current mu = 0.084) allocation failure; GC in old space requested
[82477:0xac95ec000]   129483 ms: Mark-Compact (reduce) 4088.4 (4100.5) -> 4087.7 (4099.8) MB, pooled: 0.0 MB, 286.32 / 0.00 ms (+ 0.0 ms in 2 steps since start of marking, biggest step 0.0 ms, walltime since start of marking 358 ms) (average mu = 0.479, c
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x1048318ac node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 2: 0x10496036c v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 3: 0x104960324 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 4: 0x104b0db68 v8::internal::Heap::ShouldOptimizeForLoadTime() const [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 5: 0x104b0d224 v8::internal::Heap::EagerlyFreeExternalMemoryAndWasmCode() [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 6: 0x104b0c3b8 v8::internal::Heap::CollectGarbage(v8::internal::AllocationSpace, v8::internal::GarbageCollectionReason, v8::GCCallbackFlags, v8::internal::PerformHeapLimitCheck) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 7: 0x104b04a3c std::__1::invoke_result<v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment, v8::internal::AllocationHint)::$_0&>::type v8::internal::HeapAllocator::CollectGarbageAndRetryAllocation<v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment, v8::internal::AllocationHint)::$_0&>(v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment, v8::internal::AllocationHint)::$_0&, v8::internal::AllocationType) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 8: 0x104b038ac v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment, v8::internal::AllocationHint) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 9: 0x104aebd68 v8::internal::Factory::NewFillerObject(int, v8::internal::AllocationAlignment, v8::internal::AllocationType, v8::internal::AllocationOrigin) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
10: 0x104dfbc00 v8::internal::Runtime_AllocateInOldGeneration(int, unsigned long*, v8::internal::Isolate*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
11: 0x1051f9474 Builtins_CEntry_Return1_ArgvOnStack_NoBuiltinExit [/opt/homebrew/Cellar/node/25.2.1/bin/node]
12: 0x129fea320 
13: 0x105155a38 Builtins_JSConstructStubGeneric [/opt/homebrew/Cellar/node/25.2.1/bin/node]
14: 0x12a1d6e70 
15: 0x12a1b5b30 
16: 0x12a05a948 
17: 0x10515696c Builtins_JSEntryTrampoline [/opt/homebrew/Cellar/node/25.2.1/bin/node]
18: 0x105156610 Builtins_JSEntry [/opt/homebrew/Cellar/node/25.2.1/bin/node]
19: 0x104a786d4 v8::internal::(anonymous namespace)::Invoke(v8::internal::Isolate*, v8::internal::(anonymous namespace)::InvokeParams const&) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
20: 0x104a780b8 v8::internal::Execution::Call(v8::internal::Isolate*, v8::internal::DirectHandle<v8::internal::Object>, v8::internal::DirectHandle<v8::internal::Object>, v8::base::Vector<v8::internal::DirectHandle<v8::internal::Object> const>) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
21: 0x1058d7148 v8::Function::Call(v8::Isolate*, v8::Local<v8::Context>, v8::Local<v8::Value>, int, v8::Local<v8::Value>*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
22: 0x10479cedc node::InternalMakeCallback(node::Environment*, v8::Local<v8::Object>, v8::Local<v8::Object>, v8::Local<v8::Function>, int, v8::Local<v8::Value>*, node::async_context, v8::Local<v8::Value>) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
23: 0x1047a8c34 node::AsyncWrap::MakeCallback(v8::Local<v8::Function>, int, v8::Local<v8::Value>*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
24: 0x104835834 node::fs::FSReqCallback::Resolve(v8::Local<v8::Value>) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
25: 0x1048364c4 node::fs::AfterScanDir(uv_fs_s*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
26: 0x10482c4d4 node::MakeLibuvRequestCallback<uv_fs_s, void (*)(uv_fs_s*)>::Wrapper(uv_fs_s*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
27: 0x108896d70 uv__work_done [/opt/homebrew/Cellar/libuv/1.51.0/lib/libuv.1.0.0.dylib]
28: 0x10889a58c uv__async_io [/opt/homebrew/Cellar/libuv/1.51.0/lib/libuv.1.0.0.dylib]
29: 0x1088a8e2c uv__io_poll [/opt/homebrew/Cellar/libuv/1.51.0/lib/libuv.1.0.0.dylib]
30: 0x10889aa00 uv_run [/opt/homebrew/Cellar/libuv/1.51.0/lib/libuv.1.0.0.dylib]
31: 0x10479d5c8 node::SpinEventLoopInternal(node::Environment*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
32: 0x10485c7e4 node::NodeMainInstance::Run(node::ExitCode*, node::Environment*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
33: 0x10485c518 node::NodeMainInstance::Run() [/opt/homebrew/Cellar/node/25.2.1/bin/node]
34: 0x10480a754 node::Start(int, char**) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
35: 0x1810edd54 start [/usr/lib/dyld]
