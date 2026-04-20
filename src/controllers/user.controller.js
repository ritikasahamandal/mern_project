import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from "../utils/apiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"

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

export {registerUser}