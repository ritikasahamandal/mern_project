import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from "../utils/apiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import jwt from "jsonwebtoken"
import { JsonWebTokenError } from "jsonwebtoken"


const generateAccessAndRefreshToken= async(userId)=>{
   try {
      await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refershToken = user.generateRefreshToken()

      user.refershToken = refershToken
      user.save({validateBeforeSave: false})

      return {accessToken, refershToken}


   } catch (error) {
      throw new ApiError(500, "something went wrong while generating Refersh and Access Token")
   }
}

const registerUser = asyncHandler(async(req, res)=>{
   // get user details from frontend
   //validation - not empty
   //check if user already exist: username, email
   //check for images, check for avatar
   //upload them to cloudinary, avatar
   //create user object - create entry in db
   // remove password and refresh token field from reponse
   // check for user creation
   //return res
   
   const {fullname, email, username, password} = req.body
   console.log("email:", email);

   // if (fullName ===""){
   //    throw new ApiError(400, "fullname is required")
   // } OR
   if (
      [fullname, email, username, password].some((field)=> field?.trim()==="")
   ){
      throw new ApiError(400, "All fields are required")
   }

   const existingUser= await User.findOne({
      $or: [{username}, { email}]
   })
   
   if(existingUser){
      throw new ApiError(409, "User with email or username already exist")
   }

   const avatarLocalpath = req.files?.avatar[0]?.path;
   const coverImageLocalpath = req.files?.coverImage[0]?.path;

   if(!avatarLocalpath){
      throw new ApiError(400, "Avatar file is required")
   }

   const avatar = await uploadOnCloudinary(avatarLocalpath)
   const coverImage = await uploadOnCloudinary(coverImageLocalpath)

   if(!avatar){
      throw new ApiError(400, "Avatar file is required")
   }

   const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase()
   })

   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
   )

   if(!createdUser){
      throw new ApiError(500, "Something went wrong while registering the user")
   }

   return res.status(201).json(
      new apiResponse(200, createdUser," user registered successfully")
   )
})

const loginUser = asyncHandler(async(req,res)=>{
   //req body->data
   //username or email
   //find the user
   //password check
   //access and refresh token
   //send cookies

   const {email, username, password}= req.body
   
   if(!username || !email){
      throw new ApiError(400, "username or password is required")
   }

   const user = await User.findOne({
      $or: [{username},{email}]
   })

   if(!user){
      throw new ApiError(404, "user doesn't exist")
   }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if(!isPasswordValid){
      throw new ApiError(401, "Invalud user credentials")
   }

   const {refershToken, accessToken}= await generateAccessAndRefreshToken(user._id)

   const loggesInUser = await User.findById(user._id)
   select("-password -refreshToken")

   const option ={
      httpOnly: true,
      secure: true
   }

   return res
   .status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", refershToken, options)
   .json(
      new apiResponse(200,
         {
            user: loggesInUser, accessToken, refershToken
         },
         "User logges In Successfully"
      )
   )
})

const logoutUser = asyncHandler(async(req,res)=>{
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            refreshToken: undefined
         }
      },
      {
            new: true
      }
      
   )
   const options = {
      httpOnly: true,
      secure: true
   }

   return res
   .status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json(new apiResponse(200,{}, "User logged out"))
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
  const incomingRefreshToken= req.cookies.refershToken || req.body.refershToken

  if(!incomingRefreshToken){
   throw new ApiError(401, "Unauthorized request")
  }

  try {
   const decodedToken= jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
   )
 
   const user = await User.findById(decodedToken?._id)
 
   if(!user){
    throw new ApiError(401, "invalid refresh token")
   }
 
   if(incomingRefreshToken !== user?.refreshToken){
    throw new (401, "Refresh token is expired or used")
   }
 
   const options = {
    httpOnly: true,
    secure: true
   }
 
   const {accessToken, newrefreshToken} = await generateAccessAndRefreshToken(user._id)
 
   return res
   .status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", newrefreshToken, options)
   .json(
    new apiResponse(
       200,
       {accessToken, refreshToken: newrefreshToken},
       "Access token refreshed"
    )
   )
  } catch (error) {
   throw new ApiError(401, error?.message||"Invalid refreshToken")
  }
})

export {registerUser, loginUser, logoutUser, refreshAccessToken}