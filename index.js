;(function () {
    //  根路径 (必须有)
    var rootLocation = setRootLocation('');
    var prvLocation = null;
    var nowLocation = window.location.href;
    var contextMiddleware = [];

    var variables = {}

    /*
    *   context 中间件
    */
    function use (middleware) {
        contextMiddleware.push(middleware);
    }
    /*
    *   set设置相关的变量将挂载到app上作为变量
    */
    function set (key, val) {
        variables[key] = val
    }
    /*
    *   get获取set设置的变量
    */
    function get (key) {
        return variables[key]
    }
    // 获取跟路径
    function getRootLocation () {
        return rootLocation;
    }
    // 设置跟路径
    function setRootLocation (location) {
        rootLocation = window.location.protocol + '//' + window.location.host + resolveLocationPath(location);
        return rootLocation;
    }
    /*
    *   兼容Promise   
    */
    if (typeof Promise != 'function') {
        var resolve = function (data) {
            var fn;
            while (fn = this.callbackArr.shift()) {
                try {
                    data = fn(data);
                } catch (e) {
                    this.catchFn && this.catchFn(e);
                    continue;
                }
                if (typeof data === 'object' && data.constructor === _Promise) {
                    var timer = setInterval(function () {
                        if (data.PromiseStatus === 'resolved') {
                            clearInterval(timer);
                            resolve.call(this, data.PromiseValue);
                        }
                    }.bind(this));
                    return;
                }
            }
            this.PromiseStatus = 'resolved';
            this.PromiseValue = data;
        };
        var reject = function (err) {
            throw err;
        };
        var _Promise = function (fn) {
            this.callbackArr = [];
            this.catchFn = null;
            this.PromiseStatus = 'pending';
            fn(resolve.bind(this), reject.bind(this));
        }
        _Promise.prototype.then = function (fn) {
            this.callbackArr.push(fn);
            return this;
        }
        _Promise.prototype.catch = function (fn) {
            this.catchFn = fn;
        }
    } 
    /*
    *   Object.assign 兼容
    */
    function assign (target, obj) {
        if (Object.assign) return Object.assign(target, obj);
        if (typeof target !== 'object' || typeof target !== 'object') {
            throw 'arguments should be object';
        }
        for (var key in obj) {
            if (!target[key]) {
                target[key] = obj[key];
            }
        }
        return target;
    }
    /*
    *   此函数将路径做一个强制转化
    *   最后是此形式 /index
    *   将会在开头填上 / 结尾去掉 / 并且字符串中不允许带有 .
    */
    function resolveRoutePath (path) {
        if (typeof path !== 'string') throw 'path should be a string';
        if (path.indexOf('.') !== -1) throw 'path should not have .';
        if (path.replace(/\//g) === '') return '';
        if (path[0] !== '/') path = '/' + path;
        if (path[path.length - 1] === '/') path = path.slice(0, -1);
        return path;
    }
    function resolveLocationPath (path) {
        if (path[path.length - 1] === '/') {
            path = path.slice(0, -1);
        }
        if (path === '/') path = '/';
        return path;
    }
    function toArray (target) {
        return [].slice.call(target);
    }
    /*
    *   Router 路由核心类
    *   此类可以接受一个 (前置路径)
    *   此类有一个route方法用于添加路由
    */
    function Router (previousPath) {
        if (previousPath instanceof Router) {
            previousPath = previousPath.getRoutePath();
        }
        this.previousPath = previousPath ? resolveRoutePath(previousPath) : null;
        this.routePath;
    }
    Router.prototype.route = function (path, callback) {
        path = resolveRoutePath(path);
        this.routePath = (this.previousPath || '') + path;
        controllers.add(this.previousPath, this.routePath, callback);
        return new Router(this.routePath);
    }
    Router.prototype.getRoutePath = function () {
        return this.routePath;
    }
    /*
    *   History类 提供基本页面操控
    */
    function History (historyType, isExtends) {
        this.routePoor = {};
        this.nowMatchRoute = null;
        this.callbackArr = [];
        this.isRunningCallback = false;
        if (isExtends) return this;
        if (historyType === 'hash') {

        } else {
            return new BrowserHistory();
        }
    }
    History.prototype._createRouteObj = function (routePath, callback, previousRouteObj) {
        return {
            routePath: routePath,
            previousRouteObj: previousRouteObj,
            routeExp: this._routePath2routeExp(routePath),
            callback: callback,
        }
    }
    History.prototype._routePath2routeExp = function (routePath) {
        if (!rootLocation) throw 'rootLocation is undefined';
        var exp = rootLocation + routePath;
        exp = '/^' + exp.replace(/\//g, '\\/') + '(\\?.+?=.+?)?(\\/)?$/';
        return eval(exp);
    }
    History.prototype._createContext = function (routeObj) {
        var context = new Context({
            nowLocation: window.location.href,
            routeObj: routeObj
        });
        contextMiddleware.forEach(function (item) {
            item(context);
        });
        return context;
    }
    History.prototype._findSameRoute = function (prv, nex) {
        var i = 0;
        var str = ''
        while(prv[i] || nex[i]) {
            if (prv[i] !== nex[i]) break;
            str += prv[i] || nex[i];
            i++;
        }
        return str.replace(/(.+\/)(.+)$/, function ($1, $2) {
            return $2;
        });
    }
    History.prototype._next = function () {
        var routeObj = this.callbackArr.pop();
        var context = this._createContext(routeObj);
        if (typeof routeObj === 'object' && typeof routeObj.callback === 'function') {
            this.isRunningCallback = true;
            routeObj.callback.call(context, this._next.bind(this));
        } else {
            this.isRunningCallback = false;
        }
    }
    History.prototype._match = function (previousLocation) {
        var location = window.location.href;
        var callbackArr = [];
        var prvMatchRoute = this.nowMatchRoute;
        var shouldCallDesFn = true;
        var same = this._findSameRoute(location, previousLocation || '');
        var temp;
        var matchFlag;
        for (var key in this.routePoor) {
            temp = this.routePoor[key];
            if (temp.routeExp.test(location)) {
                matchFlag = true;
                this.nowMatchRoute = temp;
                callbackArr.push(temp);
                while (temp = temp.previousRouteObj) {
                    if (temp === prvMatchRoute) shouldCallDesFn = false;
                    if (!temp.routeExp.test(same) && temp.callback) {
                        callbackArr.push(temp);
                    } else {
                        break;
                    }
                }
            }
        }
        if (!matchFlag) {
            this.nowMatchRoute = null;
        }
        if (shouldCallDesFn && prvMatchRoute && prvMatchRoute.shouldDoDesFn) {
            prvMatchRoute.desFn && prvMatchRoute.desFn();
        }
        this.callbackArr = callbackArr;
        if (!this.isRunningCallback) this._next(previousLocation);
    }
    History.prototype.add = function (previousPath, routePath, callback) {
        if (this.routePoor[routePath]) {
            this.routePoor[routePath].callback = callback;
        }
        this.routePoor[routePath] = this._createRouteObj(routePath, callback, this.routePoor[previousPath]);
    }
    /*
    *   BrowserHistory继承History类
    *   提供详细的页面操控(基于html5)
    */
    function BrowserHistory () {
        this.history = window.history;
    }
    BrowserHistory.prototype = new History('', 1);
    BrowserHistory.prototype.push = function (data, href) {
        href = rootLocation.replace(/^https?:\/\/.+?\//, '/') + resolveRoutePath(href);
        prvLocation = window.location.href;
        if (nowLocation.replace(/^https?:\/\/.+?\//, '/') === href) return;
        this.history.pushState(data, '', href);
        this._match(prvLocation);
        nowLocation = window.location.href;
    }
    BrowserHistory.prototype.addClickEvent = function (target, fn) {
        var push = this.push.bind(this);
        target.addEventListener('click', function (e) {
            e.preventDefault();
            if (!fn || fn.call(this, e)) {
                push(
                    target.getAttribute('data-history-json'),
                    target.getAttribute('href')
                );
            }
        });
    }
    BrowserHistory.prototype.capture = function () {
        if (arguments[0].nodeName) {
            this.addClickEvent(arguments[0], arguments[1]);
        } else if (arguments[0].length) {
            for (var i = 0, len = arguments[0].length; i < len; i++) {
                this.addClickEvent(arguments[0][i], arguments[1]);
            }
        }
    }
    /*
    *   上下文对象 context
    *   此对象主要包含了一些能在路由下执行方法
    */
    function Context (conf) {
        this.previousLocation = conf.previousLocation;
        this.nowLocation = conf.nowLocation;
        this.routeObj = conf.routeObj;
        this.rootLocation = rootLocation;
    }
    Context.prototype.isFrom = function (location) {
        if (location instanceof Router) location = location.getRoutePath();
        location = rootLocation + resolveRoutePath(location);
        return prvLocation === location;
    }
    /*
    *   Loader 类 包含加载方法
    */
    function Loader () {}
    Loader.prototype.loadCache = {}
    Loader.prototype.load = function (path) {
        var that = this;
        if (that.loadCache[path]) return new Promise(function (resolve, reject) {
            resolve(that.loadCache[path]);
        });
        var xhr = new XMLHttpRequest();
        var xhrPromise;
        xhr.open('GET', path, true);
        xhr.send(null);
        xhrPromise = new Promise(function (resolve, reject) {
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status <= 304) {
                    that.loadCache[path] = xhr.responseText;
                    resolve(xhr.responseText);
                }
            }
        }); 
        return xhrPromise;
    }

    Loader.prototype._getHead = function (html, path) {
        var frag = document.createDocumentFragment();
        var childNodes = toArray(html.getElementsByTagName('head')[0].children);
        childNodes = childNodes.map(function (item) {
            return this._normalizeTag(item, path);
        }.bind(this));
        return childNodes;
    }
    Loader.prototype._getCompont = function (html, path) {
        var compont = html.getElementsByTagName('Compont')[0];
        if (!compont) compont = html.getElementsByTagName('body')[0];
        var childNodes = toArray(compont.childNodes);
        childNodes = childNodes.map(function (item) {
            return this._normalizeTag(item, path);
        }.bind(this));
        return childNodes;
    }
    /*
    *   保持script标签的活性
    */
    Loader.prototype._normalizeTag = function (tag, path) {
        var src, href;
        if (tag.nodeType === 1) {
            if (tag.nodeName === 'SCRIPT' && !tag.src) {
                var scriptTag = document.createElement('script');
                var scriptData = tag.innerHTML;
                scriptTag.innerHTML = scriptData;
                return scriptTag;
            }
            src = this._normalizeUri(tag.getAttribute('src') || '', path), 
            href = this._normalizeUri(tag.getAttribute('href') || '', path);  
            if (tag.src) tag.src = src
            if (tag.href) tag.href = href;
        }
        return tag;
    }
    Loader.prototype._normalizeUri = function (uri, path) {
        if (path[path.length - 1] !== '/') path += '/';
        if (uri[0] === '.') uri = path + uri;
        return uri;
    }
    /*
    *   整合Context原型
    */
    assign(Context.prototype, Loader.prototype);
    /*
    *   此对象为路由池
    *   以及一些相关的操作
    */
    var controllers = new History('', 0);
    var timer = setTimeout(function () {
        controllers._match();
    })
    /*
    *   监听历史记录的修改
    *   并且执行回调函数
    */
    window.onpopstate = function () {
        controllers._match(nowLocation);
        nowLocation = window.location.href;
    }
    // 设置不可访问
    function setRestrictingAccess (obj, key, val) {
        Object.defineProperty(obj, key, {
            value: val,
            writeable: false,
            enumerable: false,
            configurable: false
        });
    }
    /*
    *   判断当前环境 如果是amd环境的话 暴露接口
    */
    (function (factory) {
        var app = {
            Router: Router,
            use: use,
            set: set,
            get: get,
            capture: controllers.capture.bind(controllers),
            redirect: controllers.push.bind(controllers),
            getRootLocation: getRootLocation,
            setRootLocation: setRootLocation,
        };
        for (var key in app) {
            setRestrictingAccess(app, key, app[key])
        }
        factory(app);

    }(function (app) {
       if (typeof module === 'object' && module.exports && exports) {
            module.exports = app;
        } else {
            window.app = app;
        } 
    }))

    
}(window));
// console.log(indexRouter);