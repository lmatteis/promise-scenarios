function p(time) {
  return () =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, time);
    });
}

// engine needs to make this a promise chain:
// TakesALongTime
// SomethingFast
// AnotherFast
// FooFast
// TakesALongTime
// ShowAd
// Bar
// Main
// SomethingElse

const deferred = {};
// contains a counter of all promises and how many there are running
// then it decreases them until only 1 is left
const groupedPromises = {};

function pendingPromise([name, promiseFactory]) {
  // look through all remaining promises scenarios
  if (groupedPromises[name] == 1) {
    // resolve all immediately
    if (deferred[name]) {
      // make the others resolve as well
      deferred[name].forEach(promiseF =>
        promiseF()
      );
    }
    return Promise.resolve();
  } else {
    // decrease :(

    groupedPromises[name]--;
    return new Promise(resolve => {
      if (!deferred[name]) {
        deferred[name] = [];
      }
      deferred[name].push(resolve);
    });
  }
}

function runPromise(scenario, index) {
  if (!scenario[index]) return;
  const [name, promiseFactory] = scenario[index];

  pendingPromise(scenario[index])
    .then(() => {
      // race all the promises under this name
      return Promise.race(
        racePromiseFactories[name].map(f => f())
      );
    }) // this runs the actual promise
    .then(() => {
      console.log('executed', name);
      runPromise(scenario, index + 1);
    })
    .catch(() => {});
}

const racePromiseFactories = {};
function run(scenarios) {
  // group promises with same name
  // SEARCH HAS TO HAPPEN AT RUNTIME (is this async learning?)
  for (var i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];

    for (var x = 0; x < scenario.length; x++) {
      const [name, promiseFactory] = scenario[x];

      if (!groupedPromises[name]) {
        groupedPromises[name] = 1;
      } else {
        // increase only if it's from another thread
        groupedPromises[name] =
          groupedPromises[name] + 1;
      }
      if (!racePromiseFactories[name]) {
        racePromiseFactories[name] = [];
      }
      racePromiseFactories[name].push(
        promiseFactory
      );
    }
  }

  for (var i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    runPromise(scenario, 0);
    // for (var x = 0; x < scenario.length; x++) {
    //   const [promiseFactory, name] = scenario[x];

    // //   groupedPromises[name] = promiseFactory;

    //   //   console.log('executing:', name);
    //   //   promiseFactory();
    // }
  }
}

run([
  [
    ['WaitForCard', p(5000)],
    ['ValidateCard', p(10000)],
    ['LoadAccount', p(500)],
    ['WaitForPin', p(1000)]
  ],
  // Before account is loaded (but after card is validated) show advertisement:
  [
    ['ValidateCard', p(10000)],
    ['ShowAd', p(500)],
    ['LoadAccount', p(200)]
  ],
  [
    // Don't show ad if it's enterprise user:
    ['CheckIfEnterprise', p(500)],
    ['ShowAd', p(10)] // resolve it immediately
  ],
  [
    // 60 seconds won't elapsed because the earlier one is resolving it
    // need to account for priority
    ['ShowAd', p(6000)],
    ['DoFoo', p(100)]
  ]
  // CONFLICT SCENARIO:
  //   [['ShowAd', p(500)], ['ValidateCard', p(600)]]
  //   [['ShowAd', () => Promise.reject()]] // reject it maybe?
]);
