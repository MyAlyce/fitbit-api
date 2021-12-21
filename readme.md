QUICK TODOS:
* setup linting
* node & web playgrounds
* setup a publish script

TODO:

* explain how to add fetch for nodejs
* 
* additional header handling (localization etc.)
* a way to handle rate limiting
  - rate limiting headers only exist in node (possibly make rate limiting utils, look up how rate limiting translates to the end user)
* tests
* set up subscription endpoint on alyce
* research some form of swagger api change detection
* document:
  - examples of how to use on node js & browser
  - examples of how use the token refresh feature
* turn everything from fitbit into package. (eg. auth on nodejs & browser side)
  - separate out parts that don't have node dependencies &import the non-node dependent parts with node parts.
* add a simple way to add-in/expose fitbit api endpoints. 
* implement 'Get Activity TCX' https://dev.fitbit.com/build/reference/web-api/activity/get-activity-tcx/