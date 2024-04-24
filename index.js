const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const {check, validationResult} = require('express-validator');
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/final8021');

const Order = mongoose.model('Order',{
    name: String,
    phone: String,
    mangoJuices: Number,
    berryJuices: Number,
    appleJuices: Number
} );

const Admin = mongoose.model('Admin', {
    uname: String,
    pass: String
});

var myApp = express();

//---------------- Do not modify anything above this --------------------------

myApp.set('views', path.join(__dirname, 'views'));
myApp.use(express.static(__dirname+'/public'));
myApp.set('view engine', 'ejs');
myApp.use(bodyParser.urlencoded({ extended: true }));
myApp.use(bodyParser.json());

// app.use(
//   express.static('public')
// );


myApp.use(
session({
  secret: '1234567890abcdefghijklmnopqrstuvwxyz',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },
})
);

const mangoPrice = 12.50;
const berryPrice = 13.00;
const applePrice = 12.00;

//------------- Use this space only for your routes ---------------------------


myApp.get('/',function(req, res){

    res.render('home',{ isAdmin: false,
        isLoggedIn: false, status:"other",errors: [],view_order:false,view_receipt:false,create_order:false,login:true,formData: {}});
    // use this to display the order form


});


myApp.get('/orders',function(req, res){
  var login_status = false;
  if(req.session.isLoggedIn == true){
      login_status = true;
  }
    // use this to display all the orders when a user is logged in as admin
    res.render('home',{ isAdmin: req.session.isAdmin,
      isLoggedIn: req.session.isLoggedIn, status:"other",errors: [],view_order:false,view_receipt:false,create_order:true,login:false,formData: {}});
});

myApp.post('/login_submit',async(req, res)=>{
    const { uname, pass } = req.body;
    try {
      // Check if the user exists in the MongoDB collection
      const user = await Admin.findOne({ uname, pass });
      if (user) {
        // Set session variable to indicate the user is logged in
        req.session.uname = uname;
        req.session.isLoggedIn = true;
       
        if (user.uname === "admin") {
          req.session.isAdmin = true;
          return res.render("home", {
            isAdmin: req.session.isAdmin,
            isLoggedIn: req.session.isLoggedIn,
            status: "success",
            message: "Welcome Admin!",
            errors: [],
            view_order:false,
            view_receipt:false,
            create_order:true,
            login:false,
            formData: {}
          });
        } else {
          req.session.isAdmin = false;
          return res.render("home", {
            isAdmin: req.session.isAdmin,
            isLoggedIn: req.session.isLoggedIn,
            status: "success",
            message: "Welcome!",
            errors: [], 
            view_order:false,
            view_receipt:false,
            create_order:true,
            login:false,
            formData: {}
          });
        }
      } else {
        req.session.isLoggedIn = false;
        res.render("home",{
            isAdmin: req.session.isAdmin,
            isLoggedIn: req.session.isLoggedIn,
            status: "error",
            message: "Invalid username or password",
            errors: [],
            view_order:false,
            view_receipt:false,create_order:false, login:true,formData: {}});
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }


});

// write any other routes here as per your need
const validateJuiceQuantity = (value, otherQuantities, { body }) => {
  if (value < 0) {
    throw new Error('Quantity must be greater than or equal to zero');
  }

  if (value == 0 && otherQuantities.every(quantity => quantity == 0)) {
    throw new Error('At least one juice quantity must be greater than 0');
  }

  return true;
};

// Place order route
myApp.post('/order_submit', [
  check('name').notEmpty().withMessage('Enter a valid name'),
  check('phone').matches(/^\d{3}-\d{3}-\d{4}$/).withMessage('Please enter a valid phone number (e.g., 123-456-7890)'),
  check('mango').isNumeric().withMessage('Quantity must be a number').custom((value, { req }) =>
    validateJuiceQuantity(value, [req.body.berry, req.body.apple], req)),
  check('berry').isNumeric().withMessage('Quantity must be a number').custom((value, { req }) =>
    validateJuiceQuantity(value, [req.body.mango, req.body.apple], req)),
  check('apple').isNumeric().withMessage('Quantity must be a number').custom((value, { req }) =>
    validateJuiceQuantity(value, [req.body.mango, req.body.berry], req)),
], async(req, res) => {
  // Validate order form
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.render('home', { 
      isAdmin: req.session.isAdmin,
      isLoggedIn: req.session.isLoggedIn,
      status: "error",
      message: "Try again!",
      errors: errors.array(),
      view_order:false,
      view_receipt:false,
      create_order:true,
      login:false,
      formData: req.body 
    });
  }

  // Save order to the database
  try {
    const order = new Order({
      name: req.body.name,
      phone: req.body.phone,
      mangoJuices: parseInt(req.body.mango),
      berryJuices: parseInt(req.body.berry),
      appleJuices: parseInt(req.body.apple)
    });
    
    // Save the order to the database
    await order.save();

       // Calculate Sub Total, Tax, and Total Cost
       const subTotal = order.mangoJuices * mangoPrice + order.berryJuices * berryPrice + order.appleJuices * applePrice;
      const taxRate = 0.13;
      const tax = subTotal * taxRate;
      const totalCost = subTotal + tax;
       
    // Render a success view or redirect to a different page if needed
    return res.render('home', { 
      isAdmin: req.session.isAdmin,
      isLoggedIn: req.session.isLoggedIn,
      status: "success",
      message: "Order placed successfully!",
      mangoPrice,berryPrice,applePrice,
      order,
      subTotal,
      tax,
      totalCost,
      errors: [],
      view_order: false,
      view_receipt: true,
      create_order:true,
      login:false,
      formData: req.body 
    });

  } catch (error) {
    console.log(error);
    // Handle database save error
    return res.render('home', { 
      isAdmin: req.session.isAdmin,
      isLoggedIn: req.session.isLoggedIn,
      status: "error",
      message: "Error placing order. Please try again.",
      errors: [],
      view_order: false,
      view_receipt: false,
      create_order:true,
      login:false,
      formData: req.body 
    });
  }
});

myApp.get('/view_orders', async (req, res) => {
  if(req.session.isAdmin == true){
    try {
      // Fetch all orders from the database
      const orders = await Order.find({});

      // Calculate order summary for each order
      const ordersWithSummary = orders.map(order => {
          // Calculate Sub Total, Tax, and Total Cost
          const subTotal = order.mangoJuices * mangoPrice + order.berryJuices * berryPrice + order.appleJuices * applePrice;
          const taxRate = 0.13;
          const tax = subTotal * taxRate;
          const totalCost = subTotal + tax;
  
        return {
          order,
          subTotal,
          tax,
          totalCost
        };
      });
      res.render('home', { orders:ordersWithSummary, isAdmin: req.session.isAdmin, isLoggedIn: req.session.isLoggedIn,status: "other",
      message: "",view_order:true,view_receipt:false, errors: [],create_order:false,login:false,formData: {}});
  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
  }else{
    res.render('home', { orders:{}, isAdmin: req.session.isAdmin, isLoggedIn: req.session.isLoggedIn,status: "error",
    message: "Please login as Admin",view_order:false,view_receipt:false, errors: [],create_order:false,login:true,formData: {}});
  }
 
});


myApp.post('/delete_order/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    // Delete the order from the database
    await Order.findByIdAndDelete(orderId);
    // Redirect back to the view orders page
    const orders = await Order.find({});

    const ordersWithSummary = orders.map(order => {
      const subTotal = order.mangoJuices + order.berryJuices + order.appleJuices;
      const taxRate = 0.13;
      const tax = subTotal * taxRate;
      const totalCost = subTotal + tax;

      return {
        order,
        subTotal,
        tax,
        totalCost
      };
    });
    res.render('home', { orders:ordersWithSummary, isAdmin: req.session.isAdmin, isLoggedIn: req.session.isLoggedIn,status: "error",
    message: "The order is deleted..!",view_order:true,view_receipt:false, errors: [],create_order:false,login:false,formData: {}});
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// route for logout
myApp.get('/logout', (req, res) => {
  // Clear the session variables
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Redirect the user to the home page after logout
    res.render('home',{ isAdmin: false,
      isLoggedIn: false, status:"success",message:"You are successfully logged out..!",errors: [],view_order:false,view_receipt:false,create_order:false,login:true,formData: {}});
  });
});

//---------------- Do not modify anything below this --------------------------
//------------------------ Setup the database ---------------------------------

myApp.get('/setup',function(req, res){
    
    let adminData = [{
        'uname': 'admin',
        'pass': 'admin'
    }];
    
    Admin.collection.insertMany(adminData);

    var firstNames = ['John ', 'Alana ', 'Jane ', 'Will ', 'Tom ', 'Leon ', 'Jack ', 'Kris ', 'Lenny ', 'Lucas '];
    var lastNames = ['May', 'Riley','Rees', 'Smith', 'Walker', 'Allen', 'Hill', 'Byrne', 'Murray', 'Perry'];

    let ordersData = [];

    for(i = 0; i < 10; i++){
        let tempName = firstNames[Math.floor((Math.random() * 10))] + lastNames[Math.floor((Math.random() * 10))];
        let tempOrder = {
            name: tempName,
            phone: Math.floor((Math.random() * 10000000000)),
            mangoJuices: Math.floor((Math.random() * 10)),
            berryJuices: Math.floor((Math.random() * 10)),
            appleJuices: Math.floor((Math.random() * 10))
        };
        ordersData.push(tempOrder);
    }
    
    Order.collection.insertMany(ordersData);
    res.send('Database setup complete. You can now proceed with your exam.');
    
});



//----------- Start the server -------------------

myApp.listen(8080);
console.log('Server started at 8080 for mywebsite...');