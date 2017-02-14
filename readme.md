# 简介

- 前端路由管理库

# 用例

````javascript
    
    app.setRootLocation('/example'); // 以后的路由将会以 /example为跟路径

    var Router = app.Router();
    var indexRouter = new Router()
        .route('index', function(ctx, next) { // /example/index

            // ....
            next();

        })
        .route('show', function(ctx, next) { // /example/index/show 并且index路由中的callback将会执行

            // ......

        })

    
````

# api

- app.Router

    ````javascript

    
    
    ````

    