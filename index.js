function p(name, time) {
  return [
    () =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          console.log('executed', name);
          resolve();
        }, time);
      }),
    name
  ];
}

const s1 = [
  p('TakesALongTime', 5000),
  p('ShowAd', 1000),
  p('Bar', 500),
  p('Main', 100)
];

const s2 = [
  p('SomethingFast', 500),
  p('AnotherFast', 200),
  p('FooFast', 100),
  p('ShowAd', 1000),
  p('SomethingElse', 1000)
];

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

function pendingPromise([promiseFactory, name]) {
  if (groupedPromises[name] == 1) {
    // resolve immediately
    if (deferred[name]) {
      deferred[name](); // make the other resolve as well
    }
    return Promise.resolve();
  } else {
    // decrease :(

    groupedPromises[name]--;
    return new Promise(resolve => {
      deferred[name] = resolve;
    });
  }
}

function runPromise(scenario, index) {
  if (!scenario[index]) return;
  const [promiseFactory, name] = scenario[index];
  // check if this promise exists in other threads

  pendingPromise(scenario[index])
    .then(promiseFactory)
    .then(() => {
      runPromise(scenario, index + 1);
    });
}

function run(scenarios) {
  // group promises with same name
  for (var i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];

    for (var x = 0; x < scenario.length; x++) {
      const [promiseFactory, name] = scenario[x];

      if (!groupedPromises[name]) {
        groupedPromises[name] = 1;
      } else {
        groupedPromises[name] = groupedPromises[name] + 1;
      }
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

run([s1, s2]);
