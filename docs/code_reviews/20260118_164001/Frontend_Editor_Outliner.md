Loaded cached credentials.

<--- Last few GCs --->

[82475:0x78954c000]   119349 ms: Scavenge (during sweeping) 4084.1 (4098.2) -> 4083.8 (4099.2) MB, pooled: 0.0 MB, 15.45 / 0.00 ms (average mu = 0.842, current mu = 0.877) allocation failure; 
[82475:0x78954c000]   121201 ms: Mark-Compact 4087.7 (4101.7) -> 4085.5 (4100.8) MB, pooled: 0.0 MB, 1402.40 / 0.00 ms (average mu = 0.561, current mu = 0.425) allocation failure; scavenge might not succeed

FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x1028e58ac node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 2: 0x102a1436c v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 3: 0x102a14324 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 4: 0x102bc1b68 v8::internal::Heap::ShouldOptimizeForLoadTime() const [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 5: 0x102bc1224 v8::internal::Heap::EagerlyFreeExternalMemoryAndWasmCode() [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 6: 0x102bc03b8 v8::internal::Heap::CollectGarbage(v8::internal::AllocationSpace, v8::internal::GarbageCollectionReason, v8::GCCallbackFlags, v8::internal::PerformHeapLimitCheck) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 7: 0x102bb8a3c std::__1::invoke_result<v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment, v8::internal::AllocationHint)::$_0&>::type v8::internal::HeapAllocator::CollectGarbageAndRetryAllocation<v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment, v8::internal::AllocationHint)::$_0&>(v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment, v8::internal::AllocationHint)::$_0&, v8::internal::AllocationType) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 8: 0x102bb78ac v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment, v8::internal::AllocationHint) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
 9: 0x102b9fd68 v8::internal::Factory::NewFillerObject(int, v8::internal::AllocationAlignment, v8::internal::AllocationType, v8::internal::AllocationOrigin) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
10: 0x102eafb54 v8::internal::Runtime_AllocateInYoungGeneration(int, unsigned long*, v8::internal::Isolate*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
11: 0x1032ad474 Builtins_CEntry_Return1_ArgvOnStack_NoBuiltinExit [/opt/homebrew/Cellar/node/25.2.1/bin/node]
12: 0x10320a008 Builtins_FastNewObject [/opt/homebrew/Cellar/node/25.2.1/bin/node]
13: 0x1032098f4 Builtins_JSConstructStubGeneric [/opt/homebrew/Cellar/node/25.2.1/bin/node]
14: 0x127ea56f8 
15: 0x127ea6dfc 
16: 0x127e788d0 
17: 0x127d6d6a8 
18: 0x10320a96c Builtins_JSEntryTrampoline [/opt/homebrew/Cellar/node/25.2.1/bin/node]
19: 0x10320a610 Builtins_JSEntry [/opt/homebrew/Cellar/node/25.2.1/bin/node]
20: 0x102b2c6d4 v8::internal::(anonymous namespace)::Invoke(v8::internal::Isolate*, v8::internal::(anonymous namespace)::InvokeParams const&) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
21: 0x102b2c0b8 v8::internal::Execution::Call(v8::internal::Isolate*, v8::internal::DirectHandle<v8::internal::Object>, v8::internal::DirectHandle<v8::internal::Object>, v8::base::Vector<v8::internal::DirectHandle<v8::internal::Object> const>) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
22: 0x10398b148 v8::Function::Call(v8::Isolate*, v8::Local<v8::Context>, v8::Local<v8::Value>, int, v8::Local<v8::Value>*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
23: 0x102850edc node::InternalMakeCallback(node::Environment*, v8::Local<v8::Object>, v8::Local<v8::Object>, v8::Local<v8::Function>, int, v8::Local<v8::Value>*, node::async_context, v8::Local<v8::Value>) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
24: 0x10285cc34 node::AsyncWrap::MakeCallback(v8::Local<v8::Function>, int, v8::Local<v8::Value>*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
25: 0x1028e9834 node::fs::FSReqCallback::Resolve(v8::Local<v8::Value>) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
26: 0x1028ea4c4 node::fs::AfterScanDir(uv_fs_s*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
27: 0x1028e04d4 node::MakeLibuvRequestCallback<uv_fs_s, void (*)(uv_fs_s*)>::Wrapper(uv_fs_s*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
28: 0x10694ad70 uv__work_done [/opt/homebrew/Cellar/libuv/1.51.0/lib/libuv.1.0.0.dylib]
29: 0x10694e58c uv__async_io [/opt/homebrew/Cellar/libuv/1.51.0/lib/libuv.1.0.0.dylib]
30: 0x10695ce2c uv__io_poll [/opt/homebrew/Cellar/libuv/1.51.0/lib/libuv.1.0.0.dylib]
31: 0x10694ea00 uv_run [/opt/homebrew/Cellar/libuv/1.51.0/lib/libuv.1.0.0.dylib]
32: 0x1028515c8 node::SpinEventLoopInternal(node::Environment*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
33: 0x1029107e4 node::NodeMainInstance::Run(node::ExitCode*, node::Environment*) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
34: 0x102910518 node::NodeMainInstance::Run() [/opt/homebrew/Cellar/node/25.2.1/bin/node]
35: 0x1028be754 node::Start(int, char**) [/opt/homebrew/Cellar/node/25.2.1/bin/node]
36: 0x1810edd54 start [/usr/lib/dyld]
