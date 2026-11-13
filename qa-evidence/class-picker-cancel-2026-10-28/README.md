# Cancel New class picker recovery

Native WordPress138 revealed that Cancel correctly reset the native select but left the enhanced trigger displaying the cancelled action. Save remained disabled and no data changed. The cancellation now dispatches the select normal change contract after resetting its native value, so the enhanced label returns to Add a class.

Regression drives the actual enhanced picker through asynchronous Cancel, asserts document/history unchanged, then confirms another New class attempt succeeds. Build, typecheck, focused tests and full suite pass:2933tests,5skipped. Demo has0findings. Source-only gallery proof again finds all12actualoutputs and24PNGbytes unchanged; no fresh gallery capture claimed. Native Cloud staging and matching WordPress139 checks remain required.

One local proof command initially requested unavailable tsx loader. Running the existing script directly with Node succeeded. This was tooling invocation only, not a product failure.
