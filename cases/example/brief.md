requests[1]{ref,kind,text}:
  S1,goal,"Retry the flaky upload with backoff instead of failing the build."
changes[1]{change,where,behavior}:
  CH1,src/upload.ts (uploadWithRetry),"uploadWithRetry: + retries up to 3 times, waiting 1s, 2s, 4s"
process[1]{ref,kind,fact}:
  PR1,test,"Tests failed twice on a timeout, then passed after the backoff change."
doNotSay[1]{kind,text}:
  numbers,"Never say more than 3 retries."
