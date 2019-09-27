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

function pendingPromise(promiseItem) {
  let [name] = promiseItem;
  name = name.replace('>', '');
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
  var [name, promiseFactory] = scenario[index];

  name = name.replace('>', '');

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
    .catch(() => {
      // this runs for each promise chain
      // hence if one rejects, they will all reject, which is what we want.
      // but there might be chains "suspending" for
      // a promise that exists in this chain and we need a way
      // to free these chains. by deferred[name][..]() will unsupend
      // the promises in these chains
      // hence we need to iterate through all promises in the chain that
      // was rejected (this scenario), check the counter if it's ready to
      // execute and call deferred[name][..]()
      // for each one
      //
      // for (var i = 0; i < scenario.length; i++) {
      //   const [
      //     currName,
      //     currPromiseFactory
      //   ] = scenario[i];
      //   console.log(deferred[currName]);
      //   deferred[currName].forEach(promiseF =>
      //     promiseF()
      //   );
      // }
      // OR remove it from groupedPromises and racePromiseFactories
      for (var i = 0; i < scenario.length; i++) {
        let [
          currName,
          currPromiseFactory
        ] = scenario[i];
        if (!currName.startsWith('>')) {
          currName = currName.replace('>', '');
          groupedPromises[currName]--;
          // XXX should remove currPromiseFactory
          racePromiseFactories[currName].pop();
        }
      }
      for (var x = 0; x < scenario.length; x++) {
        const [
          currName,
          currPromiseFactory
        ] = scenario[x];
        if (currName.startsWith('>')) {
          // continue running ONLY the promises
          // in this chain with a > in front

          runPromise(scenario, x);
          break; // ONLY FIRST ONE
        }
      }
    });
}

const racePromiseFactories = {};
function run(scenarios) {
  // group promises with same name
  // SEARCH HAS TO HAPPEN AT RUNTIME (is this async learning?)
  for (var i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];

    for (var x = 0; x < scenario.length; x++) {
      let [name, promiseFactory] = scenario[x];
      name = name.replace('>', '');

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
    ['WaitForCard', p(3000)],
    ['ValidateCard', p(1000)],
    ['LoadAccount', p(500)],
    ['WaitForPin', p(1000)]
  ],
  // Before account is loaded (but after card is validated) show advertisement:
  [
    ['ValidateCard', p(1000)],
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
  ],
  [
    // if is not enterprise (CheckIfEnterprise rejects)
    // show modal
    ['CheckIfEnterprise', () => Promise.reject()],
    ['ThisShouldNotHappen', p(10)],
    ['>ShowModal', p(1000)],
    ['>WaitForCard', p(10000)] // delay WaitForCard
  ]
  // CONFLICT SCENARIO:
  //   [['ShowAd', p(500)], ['ValidateCard', p(600)]]
  //   [['ShowAd', () => Promise.reject()]] // reject it maybe?
]);
