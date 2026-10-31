const express = require("express");
const router = express.Router();

// Registration API
router.post("/register", (req, res) => {

    const { name, email, password, role } = req.body;

    res.json({
        message: "Registration API working",
        user: {
            name,
            email,
            role
        }
    });

});

// Login API
router.post("/login", (req, res) => {

    const { email, password } = req.body;

    res.json({
        message: "Login API working",
        email
    });

});

module.exports = router;